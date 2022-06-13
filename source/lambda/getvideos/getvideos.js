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
 * Loads all videos from the Dynamo table pointed to by the
 * the environment variable: DYNAMO_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] got event: %j", event);

  var responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json",
  };

  try {
    var scanParams = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      AttributesToGet: [
        "videoId",
        "processedDate",
        "name",
        "language",
        "translatedLanguage",
        "s3BurnedTranslatedVideoPath",
        "s3BurnedVideoPath",
        "description",
        "status",
        "statusText",
      ],
      Select: "SPECIFIC_ATTRIBUTES",
    };

    var scanResponse = await dynamoDB.scan(scanParams).promise();
    var videos = scanResponse.Items.map(mapper);

    var enableTranslate = false;
    if (
      process.env.REGION != "cn-north-1" &&
      process.env.REGION != "cn-northwest-1"
    ) {
      enableTranslate = true;
    }

    const vocabularyList = await getVocabularyList();

    for (let video of videos) {
      video.enableTranslate = enableTranslate;
    }
    var responseBody = {
      videos: videos,
      enableTranslate: enableTranslate,
      vocabularyList: vocabularyList,
      defaultLanguage: process.env.TRANSCRIBE_LANGUAGE,
    };
    console.log("Successfully scanned: %d videos from Dynamo", videos.length);

    console.log(
      "Successfully response body: %j videos from Dynamo",
      responseBody
    );

    const response = {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(responseBody),
    };

    callback(null, response);
  } catch (error) {
    console.log("Failed to load videos", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ message: "Failed to load videos: " + error }),
    };
    callback(null, response);
  }
};

async function getVocabularyList() {
  console.log('getVocabularyList start!');
  AWS.config.update({ region: process.env.REGION });
  var transcribe;
  if (
    process.env.REGION === "cn-northwest-1" ||
    process.env.REGION === "cn-north-1"
  ) {
    transcribe = new AWS.TranscribeService({
      endpoint:
        "https://cn.transcribe." + process.env.REGION + ".amazonaws.com.cn",
    });
  } else {
    transcribe = new AWS.TranscribeService();
  }

  var params = {
      MaxResults: 100,
      StateEquals: 'READY',
  };
  let vocabularyList = [];

  await transcribe.listVocabularies(params, function(err, data) {
      if (err) {
          console.log(err, err.stack); // an error occurred
      } 
      else {
          vocabularyList = data.Vocabularies;
      }     
  }).promise();

  console.log('vocabularyList: ', vocabularyList);
  return vocabularyList;

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
