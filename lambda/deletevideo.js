var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();
var s3 = new AWS.S3();
var transcribe = new AWS.TranscribeService();

/**
 * Deletes a video, removes assets from DynamoDB and from S3.
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

            var actions = [];

            if (await deleteFromS3(videoBucket, inputVideoKey))
            {
                actions.push("Deleted input video from S3");
            }

            if (await deleteFromS3(videoBucket, transcodedVideoKey))
            {
                actions.push("Deleted transcoded video from S3");
            }

            if (await deleteFromS3(audioBucket, audioKey))
            {
                actions.push("Deleted transcoded audio from S3");
            }

            if (await deleteFromS3(transcribeBucket, transcribeKey))
            {
                actions.push("Deleted Transcribe output from S3");
            } 

            if (await deleteTranscribeJob(videoId))
            {
                actions.push("Deleted Transcribe job");
            }           

            if (await deleteCaptionsFromDynamo(videoId))
            {
                actions.push("Deleted captions from DynamoDB");
            }

            if (await deleteVideoFromDynamo(videoId))
            {
                actions.push("Deleted video from DynamoDB");   
            }

            actions.push("Video successfully deleted");

            const response = {
                statusCode: 200,
                headers: responseHeaders,
                body: JSON.stringify({  "actions": actions })
            }; 

            console.log("[INFO] made response: %j", response);           

            callback(null, response);
        }
        else
        {
            throw new Error('Video not found');
        }
    }
    catch (error)
    {
        console.log("[ERROR] Failed to delete video and assets", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  
                "message": "Failed to delete video: " + error 
            })
        };
        callback(null, response);
    }
};

/**
 * Deletes captions from DynamoDB
 */
async function deleteCaptionsFromDynamo(videoId)
{
    try
    {
        var params = 
        {
            Key: 
            {
                "videoId": 
                {
                    S: videoId
                }
            },
            TableName: process.env.DYNAMO_CAPTION_TABLE
        };
        await dynamoDB.deleteItem(params).promise();
        console.log("[INFO] Successfully deleted captions from DynamoDB");
        return true;
    }
    catch (error)
    {
        console.log("[WARNING] failed to delete captions from DynamoDB", 
            error);
        return false;
    }
}

/**
 * Deletes captions from DynamoDB
 */
async function deleteVideoFromDynamo(videoId)
{
    try
    {
        var params = 
        {
            Key: 
            {
                "videoId": 
                {
                    S: videoId
                }
            },
            TableName: process.env.DYNAMO_VIDEO_TABLE
        };
        await dynamoDB.deleteItem(params).promise();
        console.log("[INFO] Successfully deleted video from DynamoDB");
        return true;
    }
    catch (error)
    {
        console.log("[WARNING] failed to delete video from DynamoDB", 
            error);
        return false;
    }
}

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
 * Removes an existing Transcribe job if it exists
 */
async function deleteTranscribeJob(videoId)
{
    try
    {
        var deleteParams = 
        {
            TranscriptionJobName: videoId
        };

        await transcribe.deleteTranscriptionJob(deleteParams).promise();
        console.log("[INFO] deleted Transcribe job: " + videoId);
        return true;
    }
    catch (error)
    {
        console.log("[WARNING] failed to remove existing Transcribe job, perhaps it did not exist", error);
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
