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
 * Toggles video status between complete and incomplete
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

    var getParams = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
    };

    console.log("[INFO] calling getItem with parameters: %j", getParams);
    var getResponse = await dynamoDB.getItem(getParams).promise();
    console.log("[INFO] getItem response from Dynamo: %j", getResponse);

    if (getResponse.Item) {
      var video = mapper(getResponse.Item);

      var newStatus;
      var newStatusText;

      if (video.status == "COMPLETE") {
        newStatus = "PROCESSING";
        newStatusText = "Ready for processing";
      } else if (video.status == "PROCESSING") {
        newStatus = "COMPLETE";
        newStatusText = "Complete";
      } else {
        throw new Error("Video in invalid status: " + video.status);
      }

      await updateDynamoDB(videoId, newStatus, newStatusText);

      const response = {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ status: newStatus }),
      };

      callback(null, response);
    } else {
      throw new Error("Video not found");
    }
  } catch (error) {
    console.log("[ERROR] Failed to load video", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
    };
    callback(null, response);
  }
};

/**
 * Update Dynamo status and statusText for a video
 */
async function updateDynamoDB(videoId, status, statusText) {
  try {
    var params = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
      UpdateExpression: "SET #status = :status, #statusText = :statusText",
      ExpressionAttributeNames: {
        "#status": "status",
        "#statusText": "statusText",
      },
      ExpressionAttributeValues: {
        ":status": {
          S: status,
        },
        ":statusText": {
          S: statusText,
        },
      },
      ReturnValues: "NONE",
    };

    var result = await dynamoDB.updateItem(params).promise();

    console.log("[INFO] successfully updated DynamoDB status");
  } catch (error) {
    console.log("[ERROR] to update DynamoDB status", error);
    throw error;
  }
}

/**
 * Mapper which flattens item keys for 'S' types
 */
function mapper(data) {
  let S = "S";

  if (isObject(data)) {
    let keys = Object.keys(data);
    while (keys.length) {
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
