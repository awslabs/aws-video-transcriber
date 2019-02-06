var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var lambda = new AWS.Lambda();
var dynamoDB = new AWS.DynamoDB();
var s3 = new AWS.S3();

/**
 * Reprocesses a video by invoking the extractaudio
 * Lambda directly, cleans up some S3 breadcrumbs to keep
 * Elastic Trancoder happy
 */
exports.handler = async (event, context, callback) => {

    console.log('[INFO] got event: %j', event);

    var responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
    };

    try
    {
    	var videoId = event.pathParameters.videoId;

        var getParams = {
            TableName: process.env.DYNAMO_VIDEO_TABLE,
            Key: 
            {
                'videoId' : { 'S': videoId },
            },
        };

        console.log("[INFO] calling getItem with parameters: %j", getParams);
        var getResponse = await dynamoDB.getItem(getParams).promise();
        console.log("[INFO] getItem response from Dynamo: %j", getResponse);

        if (getResponse.Item)
        {
            var video = mapper(getResponse.Item);

            const videoBucket = process.env.VIDEO_BUCKET;
            const inputVideoKey = video.s3VideoPath.substring(6 + videoBucket.length);            
			const transcodedVideoKey = video.s3TranscodedVideoPath.substring(6 + videoBucket.length);

            const audioBucket = process.env.AUDIO_BUCKET;
            const audioKey = video.s3AudioPath.substring(6 + videoBucket.length);

			const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
            const transcribeKey = videoId + ".json";

            await deleteFromS3(audioBucket, audioKey);
            await deleteFromS3(transcribeBucket, transcribeKey);

            if (transcodedVideoKey != inputVideoKey)
            {
            	await deleteFromS3(videoBucket, transcodedVideoKey);
            }

            var s3Event = 
            {
				Records: 
				[
					{
						s3:
						{
							bucket:
							{
								name: videoBucket
							},
							object:
							{
								key: encodeURIComponent(inputVideoKey)
							}
						}
					}
				]
            };


			var params = {
				FunctionName: process.env.EXTRACT_AUDIO_FUNCTION,
				InvocationType: 'Event',
				Payload: JSON.stringify(s3Event)
			};

            await lambda.invoke(params).promise();

            const response = {
                statusCode: 200,
                headers: responseHeaders
            };

            callback(null, response);
        }
        else
        {
            throw new Error('Video not found');
        }
    }
    catch (error)
    {
        console.log("[ERROR] Failed to reprocess video", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  
                "message": "Failed to reprocess video: " + error 
            })
        };
        callback(null, response);
    }

};

/**
 * Deletes an object from S3 returning true if 
 * the object was deleted successfully
 */
async function deleteFromS3(bucket, key)
{
    try
    {
        var deleteParams = {
            Bucket: bucket,
            Key: key
        };

        await s3.deleteObject(deleteParams).promise();

        console.log("[INFO] successfully deleted object: s3://%s/%s", bucket, key);

        return true;
    }
    catch (error)
    {
        console.log("[WARNING] failed to delete from s3://%s/%s cause: %s", 
            bucket, key, error);
        return false;
    }
}

/**
 * Mapper which flattens item keys for 'S' types
 */
function mapper(data) {
    
    let S = "S";

    if (isObject(data)) 
    {
        let keys = Object.keys(data);
        while (keys.length) 
        {
            let key = keys.shift();
            let types = data[key];

            if (isObject(types) && types.hasOwnProperty(S)) {
                data[key] = types[S];
            } 
        }
    }

    return data;
}

/**
 * isObject helper function
 */
function isObject(value) {
    return typeof value === "object" && value !== null;
}

