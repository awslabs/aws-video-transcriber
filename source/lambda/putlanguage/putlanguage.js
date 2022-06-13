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
var uuidv4 = require("uuid/v4");
var dynamoDB = new AWS.DynamoDB();

/**
 * Saves captions to Dynamo
 */
exports.handler = async (event, context, callback) => {
  console.log("Event: %j", event);

  var responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json",
  };

  try {
    var body = JSON.parse(event.body);
    var videoId = uuidv4();
    var ddbParams = {};
    ddbParams.videoId = videoId;
    ddbParams.videoName = body.videoName;
    ddbParams.language = body.language;
    ddbParams.vocabulary = body.vocabulary || '';

    ddbParams.inputS3Path =
      "s3://" + process.env.INPUT_BUCKET + "/videos/" + body.videoName;
    if (body.inputS3Path != null) {
      console.log("[INFO] get s3 path from request", body.inputS3Path);
      ddbParams.inputS3Path = body.inputS3Path;
    }

    await updateDynamoDB(ddbParams);

    var responseBody = {
      videoId: videoId,
    };

    const response = {
      statusCode: 200,
      body: JSON.stringify(responseBody),
      headers: responseHeaders,
    };
    callback(null, response);
  } catch (error) {
    console.log("[ERROR] failed to put captions", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ message: "Failed to put captions: " + error }),
    };
    callback(null, response);
  }
};

/**
 * Update the DynamoDB Table with the latest status
 */
async function updateDynamoDB(ddbParams) {
  console.log("[INFO] saving language to DynamoDB using params: %j", ddbParams);

  var putParams = {
    TableName: process.env.DYNAMO_VIDEO_TABLE,
    Item: {
      videoId: { S: ddbParams.videoId },
      name: { S: ddbParams.videoName },
      s3VideoPath: { S: ddbParams.inputS3Path },
      language: { S: ddbParams.language },
      vocabulary: { S: ddbParams.vocabulary },
    },
  };

  try {
    console.log(
      "[INFO] putting item into Dynamo with parameters: %j",
      putParams
    );
    const putData = await dynamoDB.putItem(putParams).promise();
    console.log("[INFO] successfully put item with response: %j", putData);
  } catch (error) {
    console.log("[ERROR] failed to put video item into DynamoDB", error);
    throw error;
  }
}
