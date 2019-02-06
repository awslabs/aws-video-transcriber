var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();

/**
 * Updates the status of a video in the 
 * DynamoDB table: DYNAMO_VIDEO_TABLE
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

        var requestData = JSON.parse(event.body);
        var status = requestData.status;
        var statusText = requestData.statusText;

        await updateDynamoDB(videoId, status, statusText);

        const response = {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify({  "status": status, "statusText": statusText })
        };

        callback(null, response);
    }
    catch (error)
    {
        console.log("[ERROR] Failed to update video status", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  "message": "Failed to update video status: " + error.message })
        };
        callback(null, response);
    }
};

/**
 * Update Dynamo status and statusText for a video
 */
async function updateDynamoDB(videoId, status, statusText)
{
    try
    {
        var params = {
            TableName: process.env.DYNAMO_VIDEO_TABLE,
            Key: 
            {
                "videoId" : { "S": videoId }
            },
            UpdateExpression: "SET #status = :status, #statusText = :statusText",
            ExpressionAttributeNames: {
                "#status": "status",
                "#statusText": "statusText",
            },
            ExpressionAttributeValues: {
                ":status": {
                    S: status
                },
                ":statusText": {
                    S: statusText
                }
            },
            ReturnValues: "NONE"            
        };

        var result = await dynamoDB.updateItem(params).promise();

        console.log("[INFO] successfully updated DynamoDB status");
    }
    catch (error)
    {
        console.log("[ERROR] to update DynamoDB status", error);
        throw error;
    }
}