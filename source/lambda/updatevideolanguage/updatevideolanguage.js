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
var transcribe = new AWS.TranscribeService();
var dynamoDB = new AWS.DynamoDB();

/**
 * Updates the language of a video in the
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
    var jobName = event.detail["JobName"];
    var jobResult = await getTranscriptionJob(jobName);
    var language = jobResult["TranscriptionJob"]["LanguageCode"];

    console.log(
      "[INFO] update dynamoDB and videoId is %s and language is %s",
      jobName,
      language
    );
    await updateDynamoDB(jobName, language);

    const response = {
      statusCode: 200,
      headers: responseHeaders,
    };

    callback(null, response);
  } catch (error) {
    console.log("[ERROR] Failed to update video language", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to update video language: " + error.message,
      }),
    };
    callback(null, response);
  }
};

/**
 * Get transcription job
 */
async function getTranscriptionJob(jobName) {
  var params = {
    TranscriptionJobName: jobName,
  };
  var jobResult = await transcribe.getTranscriptionJob(params).promise();
  console.log("[INFO] got getTranscriptionJob() response: %j", jobResult);
  return jobResult;
}

/**
 * Update Dynamo language for a video
 */
async function updateDynamoDB(videoId, language) {
  try {
    var params = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
      UpdateExpression: "SET #language = :language",
      ExpressionAttributeNames: {
        "#language": "language",
      },
      ExpressionAttributeValues: {
        ":language": {
          S: language,
        },
      },
      ReturnValues: "NONE",
    };

    var result = await dynamoDB.updateItem(params).promise();

    console.log("[INFO] successfully updated DynamoDB video language");
  } catch (error) {
    console.log("[ERROR] updating DynamoDB video language", error);
    throw error;
  }
}
