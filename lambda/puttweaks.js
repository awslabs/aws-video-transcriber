
var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB({apiVersion: '2012-10-08'});

/**
 * Saves tweaks to the Dynamo table pointed to by the
 * the environment variable: CONFIG_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {

    console.log("Event: %j", event);

    var responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
    }; 

    try
    {
        var params = {
            TableName: process.env.DYNAMO_CONFIG_TABLE,
            Item: 
            {
                'configId' : {'S': 'tweaks'},
                'configValue' : {'S': event.body }
            }
        };

        var putResponse = await dynamoDB.putItem(params).promise();
    
        console.log("Successfully updated tweaks");
        const response = {
            statusCode: 200,
            headers: responseHeaders,
            body: event.body
        };
        callback(null, response);
    }
    catch (error)
    {
        console.log('[ERROR] failed to update tweaks', error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ "message": "Failed to update teaks: " + error })
        };
        callback(null, response);
    }
};