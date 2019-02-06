/**
  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  
  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  A copy of the License is located at
  
      http://www.apache.org/licenses/LICENSE-2.0
  
  or in the "license" file accompanying this file. This file is distributed 
  on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either 
  express or implied. See the License for the specific language governing 
  permissions and limitations under the License.
*/

var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB({apiVersion: '2012-10-08'});

/**
 * Saves captions to Dynamo
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
        var videoId = event.pathParameters.videoId;

        var body = JSON.parse(event.body);

        var params = {
            TableName: process.env.DYNAMO_CAPTION_TABLE,
            Item: 
            {
                'videoId' : {'S': videoId},
                'captions' : {'S': JSON.stringify(body.captions) },
                'processedDate':  {'S': new Date().toISOString() }
            }
        };

        var putResponse = await dynamoDB.putItem(params).promise();
    
        console.log("Successfully put captions");

        const response = {
            statusCode: 200,
            headers: responseHeaders
        };
        callback(null, response);
    }
    catch (error)
    {
        console.log('[ERROR] failed to put captions', error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ "message": "Failed to put captions: " + error })
        };
        callback(null, response);
    }
};