/**
  Copyright 2021 Amazon.com, Inc. or its affiliates. All Rights Reserved.
  
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

exports.handler = async (event, context, callback) => {
  console.log("[INFO] got event: %j", event);

  var responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json",
  };

  try {
    var body = JSON.parse(event.body);

    var videoId = body.videoId;
    var translated = body.translated;
    var destKeyPrefix = body.destKeyPrefix;
    var destBucket = body.destBucket;
    var videoName = body.videoName;

    var getVideoResponse = await getVideoInfo(videoId);

    if (getVideoResponse.Item) {
      var video = mapper(getVideoResponse.Item);

      await generateCaptions(
        videoId,
        video.translatedLanguage,
        translated,
        destBucket,
        destKeyPrefix,
        videoName
      );

      var sourceS3Path;
      if (translated == "true") {
        sourceS3Path = video.s3BurnedTranslatedVideoPath;
      } else {
        sourceS3Path = video.s3BurnedVideoPath;
      }
      // await moveBurnedVedio(destBucket, destKeyPrefix, videoName, sourceS3Path);

      var responseBody = {
        vttPath: destKeyPrefix + "/" + videoName + ".vtt",
        srtPath: destKeyPrefix + "/" + videoName + ".srt",
        //   "burnedVideoPath": destKeyPrefix + "/" + videoName + ".mp4",
      };
      const response = {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify(responseBody),
      };

      console.log("[INFO] made response: %j", response);

      callback(null, response);
    } else {
      throw new Error("Video not found");
    }
  } catch (error) {
    console.log(
      "[ERROR] Failed to burn in captions with uploaded video",
      error
    );
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to burn in captions: " + error,
      }),
    };
    callback(null, response);
  }
};

async function getVideoInfo(videoId) {
  getParams = {
    TableName: process.env.DYNAMO_VIDEO_TABLE,
    Key: {
      videoId: { S: videoId },
    },
  };

  console.log("[INFO] calling getItem with parameters: %j", getParams);
  var getVideoResponse = await dynamoDB.getItem(getParams).promise();
  console.log("[INFO] getItem response from Dynamo: %j", getVideoResponse);
  return getVideoResponse;
}

async function generateCaptions(
  videoId,
  language,
  translated,
  destBucket,
  destKeyPrefix,
  videoName
) {
  const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
  var captionsKey = "";
  var srtCaptionsKey = destKeyPrefix + "/" + videoName + ".srt";
  var vttCaptionsKey = destKeyPrefix + "/" + videoName + ".vtt";

  if (translated == "true") {
    captionsKey = "captions/" + videoId + "_" + language + ".json";
  } else {
    captionsKey = "captions/" + videoId + ".json";
  }
  var captionS3Params = {
    Bucket: transcribeBucket,
    Key: captionsKey,
  };
  var captionsObject = await s3.getObject(captionS3Params).promise();
  captionsStr = captionsObject.Body.toString();
  var captions = JSON.parse(captionsStr);
  var srtCaptions = await exportCaptions("srt", captions, language);
  var vttCaptions = await exportCaptions("webvtt", captions, language);

  await s3
    .putObject({
      Bucket: destBucket,
      Key: srtCaptionsKey,
      ContentType: "binary/octet-stream",
      Body: srtCaptions,
    })
    .promise();

  await s3
    .putObject({
      Bucket: destBucket,
      Key: vttCaptionsKey,
      ContentType: "binary/octet-stream",
      Body: vttCaptions,
    })
    .promise();
}

async function moveBurnedVedio(
  destBucket,
  destKeyPrefix,
  destFileName,
  sourceS3Path
) {
  var sourceFile = sourceS3Path.substring(4, sourceS3Path.lenght);
  console.log("[INFO] sourceFile", sourceFile);
  var copyRequest = {
    Bucket: destBucket,
    Key: destKeyPrefix + "/" + destFileName + ".mp4",
    CopySource: sourceFile,
  };

  await s3.copyObject(copyRequest).promise();
}

async function exportCaptions(format, captions, language) {
  if (format === "webvtt") {
    var webvtt = "WEBVTT\n\n";

    for (var i in captions) {
      var caption = captions[i];

      if (caption.text.trim() === "") {
        continue;
      }

      webvtt +=
        caption.startTime.replace(",", ".") +
        " --> " +
        caption.endTime.replace(",", ".") +
        "\n";
      var captionText = splitSentence(caption.text, language);
      webvtt += captionText + "\n";
    }

    return webvtt;
  } else if (format === "srt") {
    var srt = "";

    var index = 1;

    for (var i in captions) {
      var caption = captions[i];

      if (caption.text.trim() === "") {
        continue;
      }

      srt += index + "\n";
      srt += caption.startTime + " --> " + caption.endTime + "\n";
      var captionText = splitSentence(caption.text, language);
      srt += captionText + "\n";
      index++;
    }

    return srt;
  } else {
    throw new Error("Invalid format requested: " + format);
  }
}

function splitSentence(text, language) {
  var lenght = text.length;
  var finalText = "";
  if (
    language.indexOf("zh") > -1 ||
    language.indexOf("ja") > -1 ||
    language.indexOf("ko") > -1
  ) {
    var maxSentenceLength = 25;
    var paraCount = parseInt(lenght / maxSentenceLength);
    for (var i = 0; i < paraCount; i++) {
      finalText +=
        text.substring(i * maxSentenceLength, (i + 1) * maxSentenceLength) +
        "\n";
    }
    if (paraCount * maxSentenceLength < lenght) {
      finalText += text.substring(paraCount * maxSentenceLength, lenght) + "\n";
    }
  } else {
    var maxSentenceLength = 50;
    var sentenceCount = parseInt(lenght / maxSentenceLength);
    var currentPosition = 0;
    var nextPosition = 0;
    for (var i = 0; i < sentenceCount; i++) {
      currentPosition = nextPosition;
      nextPosition = text.indexOf(" ", (i + 1) * maxSentenceLength) + 1;
      if (nextPosition == 0) {
        nextPosition = text.lenght;
      }
      finalText += text.substring(currentPosition, nextPosition) + "\n";
    }
    if (nextPosition < lenght) {
      finalText += text.substring(nextPosition, lenght) + "\n";
    }
  }
  return finalText;
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
