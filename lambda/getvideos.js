var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();

/**
 * Loads all videos from the Dynamo table pointed to by the
 * the environment variable: DYNAMO_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {

    var responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
    }; 

    try
    {
        var scanParams = {
            TableName: process.env.DYNAMO_VIDEO_TABLE,
            AttributesToGet: [
                'videoId',
                'processedDate',
                'name',
                'description',
                'status',
                'statusText'
            ],
            Select: 'SPECIFIC_ATTRIBUTES'
        };

        var scanResponse = await dynamoDB.scan(scanParams).promise();
        var videos = scanResponse.Items.map(mapper);

        console.log("Successfully scanned: %d videos from Dynamo", videos.length);        

        const response = {
            statusCode: 200,
            headers: responseHeaders,
            body: JSON.stringify({  "videos": videos })
        };

        callback(null, response);        
    }
    catch (error)
    {
        console.log("Failed to load videos", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  "message": "Failed to load videos: " + error })
        };
        callback(null, response);
    }
};

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