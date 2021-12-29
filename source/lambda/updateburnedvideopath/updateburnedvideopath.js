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

/*
  update burnedVideo path in DDB
*/

var AWS = require("aws-sdk");
var path = require("path");
AWS.config.update({ region: process.env.REGION });
var dynamoDB = new AWS.DynamoDB();

exports.handler = async (event, context, callback) => {
  console.log("[INFO] got event: %j", event);

  try {
    var inputParams = await computeParameters(event);

    await updateDynamoDB(inputParams);
  } catch (error) {
    console.log("ERROR, ", error);
  }
};

/**
 * Update Dynamo status and video download url
 */
async function updateDynamoDB(params) {
  console.log("[INFO] dynamoVideoTable: %s", params.dynamoVideoTable);
  console.log("[INFO] videoId: %s", params.videoId);
  try {
    var s3BurnedVideoPath =
      "s3://" + params.inputBucket + "/" + params.inputKey;
    console.log("[INFO] update s3BurnedVideoPath: %s", s3BurnedVideoPath);
    var updateParams = {};
    if (params.translated) {
      var updateParams = {
        TableName: params.dynamoVideoTable,
        Key: {
          videoId: { S: params.videoId },
        },
        UpdateExpression:
          "SET #s3BurnedTranslatedVideoPath = :s3BurnedTranslatedVideoPath",
        ExpressionAttributeNames: {
          "#s3BurnedTranslatedVideoPath": "s3BurnedTranslatedVideoPath",
        },
        ExpressionAttributeValues: {
          ":s3BurnedTranslatedVideoPath": {
            S: s3BurnedVideoPath,
          },
        },
        ReturnValues: "NONE",
      };
    } else {
      var updateParams = {
        TableName: params.dynamoVideoTable,
        Key: {
          videoId: { S: params.videoId },
        },
        UpdateExpression: "SET #s3BurnedVideoPath = :s3BurnedVideoPath",
        ExpressionAttributeNames: {
          "#s3BurnedVideoPath": "s3BurnedVideoPath",
        },
        ExpressionAttributeValues: {
          ":s3BurnedVideoPath": {
            S: s3BurnedVideoPath,
          },
        },
        ReturnValues: "NONE",
      };
    }

    await dynamoDB.updateItem(updateParams).promise();

    console.log("[INFO] successfully updated DynamoDB status");
  } catch (error) {
    console.log("[ERROR] to update DynamoDB status", error);
    throw error;
  }
}

/**
 * Computes parameters
 */
async function computeParameters(event) {
  console.log("[INFO] computeParameters start");
  var inputKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );

  var videoFile = path.basename(inputKey);
  var translated = videoFile.endsWith("translated.mp4", videoFile.length);
  var positions = getPositions(videoFile, "_");

  var videoId = videoFile.substring(
    positions[positions.length - 2] + 1,
    positions[positions.length - 1]
  );
  console.log("videoId: ", videoId);
  var inputBucket = event.Records[0].s3.bucket.name;

  var outPutParams = {
    inputKey: inputKey,
    videoId: videoId,
    translated: translated,
    dynamoVideoTable: process.env.DYNAMO_VIDEO_TABLE,
    inputBucket: inputBucket,
  };
  console.log("[INFO] computed initial parameters: %j", outPutParams);

  return outPutParams;
}

function getPositions(string, subStr) {
  var positions = new Array();
  var pos = string.indexOf(subStr);
  while (pos > -1) {
    positions.push(pos);
    pos = string.indexOf(subStr, pos + 1);
  }
  return positions;
}
