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
var s3 = new AWS.S3();

/**
 * Fetches captions in WEBVTT or SRT formats
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] got event: %j", event);

  try {
    var format = "webvtt";
    var contentType = "text/vtt";
    var language = "";

    if (event.queryStringParameters && event.queryStringParameters.format) {
      format = event.queryStringParameters.format;
    }

    if (event.queryStringParameters && event.queryStringParameters.language) {
      language = event.queryStringParameters.language;
    }

    if (format === "srt") {
      contentType = "text/srt";
    } else if (format === "text") {
      contentType = "text/plain";
    } else {
      contentType = "text/vtt";
    }

    console.log("[INFO] exporting in: %s format", format);

    var videoId = event.pathParameters.videoId;

    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var captionS3Params = {
      Bucket: transcribeBucket,
      Key: "captions/" + videoId + ".json",
    };
    var captionsObject = await s3.getObject(captionS3Params).promise();

    captionsStr = captionsObject.Body.toString();

    var captions = JSON.parse(captionsStr);

    var result = await exportCaptions(format, captions, language);

    var responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
      "Content-Type": contentType,
    };
    const response = {
      statusCode: 200,
      headers: responseHeaders,
      body: result,
    };
    console.log("[INFO] response: %j", response);

    callback(null, response);
  } catch (error) {
    console.log("[ERROR] Failed to load captions", error);

    var responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
      "Content-Type": "application/json",
    };
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({ message: "Failed to load captions: " + error }),
    };
    callback(null, response);
  }
};

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
  } else if (format === "text") {
    var text = "";

    for (var i in captions) {
      var caption = captions[i];

      if (caption.text.trim() === "") {
        continue;
      }

      if (
        language.indexOf("zh") > -1 ||
        language.indexOf("ja") > -1 ||
        language.indexOf("ko") > -1
      ) {
        text += caption.text;
      } else {
        text += caption.text + " ";
      }
    }

    return text;
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
