var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();

/**
 * Updates the description of a video in the 
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
        var description = requestData.description;

        await updateDynamoDB(videoId, description);

        const response = {
            statusCode: 200,
            headers: responseHeaders
        };

        callback(null, response);
    }
    catch (error)
    {
        console.log("[ERROR] Failed to update video description", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  "message": "Failed to update video description: " + error.message })
        };
        callback(null, response);
    }
};

/**
 * Update Dynamo description for a video
 */
async function updateDynamoDB(videoId, description)
{
    try
    {
        var params = {
            TableName: process.env.DYNAMO_VIDEO_TABLE,
            Key: 
            {
                "videoId" : { "S": videoId }
            },
            UpdateExpression: "SET #description = :description",
            ExpressionAttributeNames: {
                "#description": "description"
            },
            ExpressionAttributeValues: {
                ":description": {
                    S: description
                }
            },
            ReturnValues: "NONE"            
        };

        var result = await dynamoDB.updateItem(params).promise();

        console.log("[INFO] successfully updated DynamoDB video description");
    }
    catch (error)
    {
        console.log("[ERROR] to update DynamoDB video description", error);
        throw error;
    }
}