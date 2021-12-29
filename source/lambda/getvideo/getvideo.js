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
var s3 = new AWS.S3({ signatureVersion: "v4" });
var zlib = require("zlib");

/**
 * Loads a single video from the Dynamo table pointed to by the
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
    var videoId = event.pathParameters.videoId;
    var translated = false;
    if (event.pathParameters.videoId.includes("_")) {
      videoId = event.pathParameters.videoId.substring(
        0,
        event.pathParameters.videoId.indexOf("_")
      );
      translated = true;
    }

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
      // const videoBucket = process.env.VIDEO_BUCKET;
      var index = video.s3VideoPath.indexOf("/", 5);
      const videoBucket = video.s3VideoPath.substring(5, index);
      const videoKey = video.s3VideoPath.substring(
        index + 1,
        video.s3VideoPath.length
      );
      const signedUrlExpireSeconds = 60 * 60;

      const url = s3.getSignedUrl("getObject", {
        Bucket: videoBucket,
        Key: videoKey,
        Expires: signedUrlExpireSeconds,
      });
      video.s3VideoSignedUrl = url;
      const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
      const captionsUrl = s3.getSignedUrl("getObject", {
        Bucket: transcribeBucket,
        Key: "captions/" + event.pathParameters.videoId + ".json",
        Expires: signedUrlExpireSeconds,
      });
      video.s3CaptionsSignUrl = captionsUrl;
      video.translated = translated;
      var enableTranslate = false;
      if (
        process.env.REGION != "cn-north-1" &&
        process.env.REGION != "cn-northwest-1"
      ) {
        enableTranslate = true;
      }
      video.enableTranslate = enableTranslate;

      console.log("[INFO] made signed url: " + url);

      const response = {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ video: video }),
      };
      console.log("[INFO] response: %j", response);
      callback(null, response);
    } else {
      throw new Error("Video not found");
    }
  } catch (error) {
    console.log("[ERROR] Failed to load video", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ message: "Failed to load video: " + error }),
    };
    callback(null, response);
  }
};

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
