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
var s3 = new AWS.S3();
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
/**
 * Deletes a video, removes assets from DynamoDB and from S3.
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

      var actions = [];
      const videoBucket = process.env.VIDEO_BUCKET;

      if (video.s3VideoPath) {
        console.log(
          "[INFO] Start to delete input video : %s",
          video.s3VideoPath
        );
        const inputVideoKey = video.s3VideoPath.substring(
          6 + videoBucket.length
        );
        if (await deleteFromS3(videoBucket, inputVideoKey)) {
          actions.push("Deleted input video from S3");
        }
      }

      if (video.s3TranscodedVideoPath) {
        console.log(
          "[INFO] Start to delete transcoded video: %s",
          video.s3TranscodedVideoPath
        );
        const transcodedVideoKey = video.s3TranscodedVideoPath.substring(
          6 + videoBucket.length
        );
        if (await deleteFromS3(videoBucket, transcodedVideoKey)) {
          actions.push("Deleted transcoded video from S3");
        }
      }

      if (video.s3BurnedVideoPath) {
        console.log(
          "[INFO] Start to delete burned video: %s",
          video.s3BurnedVideoPath
        );
        const burnedVideoKey = video.s3BurnedVideoPath.substring(
          6 + videoBucket.length
        );
        if (await deleteFromS3(videoBucket, burnedVideoKey)) {
          actions.push("Deleted burned video from S3");
        }
      }

      if (video.s3AudioPath) {
        console.log("[INFO] Start to delete audio: %s", video.s3AudioPath);
        const audioKey = video.s3AudioPath.substring(6 + videoBucket.length);
        const audioBucket = process.env.AUDIO_BUCKET;
        if (await deleteFromS3(audioBucket, audioKey)) {
          actions.push("Deleted transcoded audio from S3");
        }
      }

      const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
      const transcribeKey = videoId + ".json";
      console.log("[INFO] Start to delete transcribe json: %s", transcribeKey);
      if (await deleteFromS3(transcribeBucket, transcribeKey)) {
        actions.push("Deleted Transcribe output from S3");
      }

      if (await deleteTranscribeJob(videoId)) {
        actions.push("Deleted Transcribe job");
      }

      if (await deleteCaptionsFromDynamo(videoId)) {
        actions.push("Deleted captions from DynamoDB");
      }

      if (await deleteVideoFromDynamo(videoId)) {
        actions.push("Deleted video from DynamoDB");
      }

      actions.push("Video successfully deleted");

      const response = {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ actions: actions }),
      };

      console.log("[INFO] made response: %j", response);

      callback(null, response);
    } else {
      throw new Error("Video not found");
    }
  } catch (error) {
    console.log("[ERROR] Failed to delete video and assets", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to delete video: " + error,
      }),
    };
    callback(null, response);
  }
};

/**
 * Deletes captions from DynamoDB
 */
async function deleteCaptionsFromDynamo(videoId) {
  try {
    var params = {
      Key: {
        videoId: {
          S: videoId,
        },
      },
      TableName: process.env.DYNAMO_CAPTION_TABLE,
    };
    await dynamoDB.deleteItem(params).promise();
    console.log("[INFO] Successfully deleted captions from DynamoDB");
    return true;
  } catch (error) {
    console.log("[WARNING] failed to delete captions from DynamoDB", error);
    return false;
  }
}

/**
 * Deletes captions from DynamoDB
 */
async function deleteVideoFromDynamo(videoId) {
  try {
    var params = {
      Key: {
        videoId: {
          S: videoId,
        },
      },
      TableName: process.env.DYNAMO_VIDEO_TABLE,
    };
    await dynamoDB.deleteItem(params).promise();
    console.log("[INFO] Successfully deleted video from DynamoDB");
    return true;
  } catch (error) {
    console.log("[WARNING] failed to delete video from DynamoDB", error);
    return false;
  }
}

/**
 * Deletes an object from S3 returning true if
 * the object was deleted successfully
 */
async function deleteFromS3(bucket, key) {
  try {
    var deleteParams = {
      Bucket: bucket,
      Key: key,
    };

    await s3.deleteObject(deleteParams).promise();

    console.log("[INFO] successfully deleted object: s3://%s/%s", bucket, key);

    return true;
  } catch (error) {
    console.log(
      "[WARNING] failed to delete from s3://%s/%s cause: %s",
      bucket,
      key,
      error
    );
    return false;
  }
}

/**
 * Removes an existing Transcribe job if it exists
 */
async function deleteTranscribeJob(videoId) {
  try {
    var deleteParams = {
      TranscriptionJobName: videoId,
    };

    await transcribe.deleteTranscriptionJob(deleteParams).promise();
    console.log("[INFO] deleted Transcribe job: " + videoId);
    return true;
  } catch (error) {
    console.log(
      "[WARNING] failed to remove existing Transcribe job, perhaps it did not exist",
      error
    );
    return false;
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
