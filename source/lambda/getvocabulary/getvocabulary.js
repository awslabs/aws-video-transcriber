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

var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.REGION });
var dynamoDB = new AWS.DynamoDB();

/**
 * Loads vocabulary from the Dynamo table pointed to by the
 * the environment variable: CONFIG_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {
  try {
    var params = {
      TableName: process.env.DYNAMO_CONFIG_TABLE,
      Key: {
        configId: { S: "vocabulary" },
      },
    };

    var responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
      "Content-Type": "application/json",
    };

    /**
     * Fetch vocabulary from Dynamo
     */
    var getItemResponse = await dynamoDB.getItem(params).promise();

    var vocabulary = null;

    if (getItemResponse.Item) {
      vocabulary = JSON.parse(getItemResponse.Item.configValue.S);
    } else {
      vocabulary = { vocabulary: [] };
    }

    const response = {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(vocabulary),
    };
    callback(null, response);
  } catch (error) {
    console.log("Failed to fetch vocabulary", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ message: "Failed to fetch vocabulary: " + error }),
    };
    callback(null, response);
  }
};
