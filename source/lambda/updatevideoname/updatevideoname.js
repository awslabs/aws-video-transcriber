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
 * Updates the name of a video in the
 * DynamoDB table: DYNAMO_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] got event: %j", event);

  var responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json",
  };

  try {
    var videoId = event.pathParameters.videoId;

    var requestData = JSON.parse(event.body);
    var name = requestData.name;
    if (
      name.toLowerCase().endsWith(".mp4") ||
      name.toLowerCase().endsWith(".mkv") ||
      name.toLowerCase().endsWith(".mov")
    ) {
      await updateDynamoDB(videoId, name);

      const response = {
        statusCode: 200,
        headers: responseHeaders,
      };

      callback(null, response);
    } else {
      console.log(
        "[ERROR] Failed to update video name, video name must be endwith .mp4/.mov/.mkv"
      );
      const response = {
        statusCode: 500,
        headers: responseHeaders,
        body: JSON.stringify({
          message:
            "Failed to update video name, video name must be endwith .mp4/.mov/.mkv",
        }),
      };
      callback(null, response);
    }
  } catch (error) {
    console.log("[ERROR] Failed to update video name", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to update video name: " + error.message,
      }),
    };
    callback(null, response);
  }
};

/**
 * Update Dynamo name for a video
 */
async function updateDynamoDB(videoId, name) {
  try {
    var params = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
      UpdateExpression: "SET #name = :name",
      ExpressionAttributeNames: {
        "#name": "name",
      },
      ExpressionAttributeValues: {
        ":name": {
          S: name,
        },
      },
      ReturnValues: "NONE",
    };

    var result = await dynamoDB.updateItem(params).promise();

    console.log("[INFO] successfully updated DynamoDB video name");
  } catch (error) {
    console.log("[ERROR] updating DynamoDB video name", error);
    throw error;
  }
}
