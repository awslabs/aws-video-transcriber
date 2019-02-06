
var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();

/**
 * Loads vocabulary from the Dynamo table pointed to by the
 * the environment variable: CONFIG_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {

    try
    {
        var params = {
            TableName: process.env.DYNAMO_CONFIG_TABLE,
            Key: 
            {
                'configId' : {'S': 'vocabulary'},
            },
        };

        var responseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
        };

        /** 
         * Fetch vocabulary from Dynamo
         */
        var getItemResponse = await dynamoDB.getItem(params).promise();

        var vocabulary = null;

        if (getItemResponse.Item)
        {
            vocabulary = JSON.parse(getItemResponse.Item.configValue.S);
        }
        else
        {
            vocabulary = { "vocabulary": [ ] };
        }

        const response = {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify(vocabulary)
        };
        callback(null, response);
    }
    catch (error)
    {
        console.log("Failed to fetch vocabulary", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ "message": "Failed to fetch vocabulary: " + error })
        };
        callback(null, response);
    }
    
};