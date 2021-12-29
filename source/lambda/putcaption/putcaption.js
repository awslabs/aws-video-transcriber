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
    var videoId = event.pathParameters.videoId;

    var body = JSON.parse(event.body);
    var captionIndex = body.captionIndex;
    var wordLength = body.wordLength;
    var captionText = body.text;
    var language = body.language;
    var type = body.type;
    var translated = body.translated;
    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var captionsKey;
    if (translated == "true") {
      console.log("these are translated captions");
      captionsKey = "captions/" + videoId + "_" + language + ".json";
    } else {
      captionsKey = "captions/" + videoId + ".json";
    }
    var captionS3Params = {
      Bucket: transcribeBucket,
      Key: captionsKey,
    };
    console.log("get captions object paras: %j", captionS3Params);
    var captionsObject = await s3.getObject(captionS3Params).promise();

    var captionsStr = captionsObject.Body.toString();

    var captionData = JSON.parse(captionsStr);

    if (type == "SPLITE") {
      captionData = await spliteCaptions(
        captionData,
        captionIndex,
        captionText,
        wordLength
      );
    } else if (type == "MERGE") {
      captionData = await mergeCaptions(
        captionData,
        captionIndex,
        captionText,
        language
      );
    } else if (type == "SAVE-CAPTION") {
      captionData[captionIndex].text = captionText;
    } else {
      throw new Error("Action Type is not correct");
    }

    await saveCaptions(captionsKey, captionData);

    const response = {
      statusCode: 200,
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

async function spliteCaptions(
  captionData,
  captionIndex,
  captionText,
  wordLength
) {
  console.log(
    "captionIndex is " + captionIndex + " and wordLength is " + wordLength
  );
  var id = captionData[captionIndex].id;

  var captionText1 = captionText.substring(0, wordLength);
  var captionText2 = captionText.substring(wordLength, captionText.length);

  var splitTime = getSplitTime(
    captionText,
    captionData[captionIndex].startTime,
    captionData[captionIndex].endTime,
    wordLength
  );

  var endTime = captionData[captionIndex].endTime;

  captionData[captionIndex].text = captionText1;
  captionData[captionIndex].endTime = splitTime;

  if (captionIndex < captionData.length - 1) {
    captionData.push(
      cloneCaptionDataElement(captionData[captionData.length - 1])
    );
    captionData[captionData.length - 1].id =
      Number(captionData[captionData.length - 1].id) + 1 + "";
    for (var i = captionData.length - 2; i > captionIndex + 1; i--) {
      captionData[i] = cloneCaptionDataElement(captionData[i - 1]);
      captionData[i].id = Number(captionData[i - 1].id) + 1 + "";
    }
    captionData[captionIndex + 1].id = Number(id) + 1 + "";
    captionData[captionIndex + 1].text = captionText2;
    captionData[captionIndex + 1].startTime = splitTime;
    captionData[captionIndex + 1].endTime = endTime;
  } else {
    var captionElement = {};
    captionElement.id = Number(id) + 1 + "";
    captionElement.text = captionText2;
    captionElement.startTime = splitTime;
    captionElement.endTime = endTime;
    captionData.push(captionElement);
  }

  return captionData;
}

function cloneCaptionDataElement(captionDataElement) {
  var newCaptionDataElement = {};
  newCaptionDataElement.id = captionDataElement.id;
  newCaptionDataElement.startTime = captionDataElement.startTime;
  newCaptionDataElement.endTime = captionDataElement.endTime;
  newCaptionDataElement.text = captionDataElement.text;
  return newCaptionDataElement;
}

async function mergeCaptions(captionData, captionIndex, caption, language) {
  var part1Index = captionIndex;
  var part2Index = captionIndex + 1;

  if (captionIndex >= captionData.length - 1) {
    console.log("captionIndex is the last caption, cannot merge");
    throw new Error("captionIndex is the last caption, cannot merge");
  }
  captionData[part1Index].text = caption;
  captionData[part1Index].endTime = captionData[part2Index].endTime;

  for (var i = part2Index; i < captionData.length - 1; i++) {
    captionData[i] = cloneCaptionDataElement(captionData[i + 1]);
    captionData[i].id = Number(captionData[i].id) - 1 + "";
  }
  captionData.pop();
  return captionData;
}

async function saveCaptions(captionsKey, captionData) {
  const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
  var captionS3Parmas = {
    Bucket: transcribeBucket,
    Key: captionsKey,
    ContentType: "text/plain",
    Body: JSON.stringify(captionData),
  };

  console.log("[INFO] Store captions into s3 %j", captionS3Parmas);
  await s3
    .putObject(captionS3Parmas, function (err, data) {
      if (err) console.log(err, err.stack);
      else console.log(data);
    })
    .promise();
}

/**
 * Fetch the video info from DynamoDB
 */
async function getVideo(videoId) {
  try {
    var getParams = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
    };

    console.log("[INFO] loading video using request: %j", getParams);

    var getResponse = await dynamoDB.getItem(getParams).promise();

    console.log("[INFO] got response from Dyanmo: %j", getResponse);

    if (getResponse.Item) {
      var videoInfo = mapper(getResponse.Item);
      return videoInfo;
    } else {
      throw new Error("Video not found");
    }
  } catch (error) {
    console.log("Failed to get video from DynamoDB", error);
    return {};
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

function getSplitTime(captionText, startTime, endTime, wordLength) {
  var startTimeMiSecond = miSecondNumber(startTime);
  var endTimeMiSecond = miSecondNumber(endTime);

  var miSecond = endTimeMiSecond - startTimeMiSecond;

  var miStartSecond = parseInt((wordLength / captionText.length) * miSecond);

  var splitTime = formatTime(miStartSecond + startTimeMiSecond);

  return splitTime;
}

function miSecondNumber(time) {
  var a = time.split(":");

  // minutes are worth 60 seconds. Hours are worth 60 minutes.
  var miSeconds =
    (+a[0] * 60 * 60 +
      +a[1] * 60 +
      +a[2].split(",")[0] +
      +a[2].split(",")[1] / 1000) *
    1000;
  return miSeconds;
}

function formatTime(miSecondsTime) {
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_MINUTE = 60 * 1000;
  const ONE_SECOND = 1000;
  var hours = Math.floor(miSecondsTime / ONE_HOUR);
  var remainder = miSecondsTime - hours * ONE_HOUR;
  var minutes = Math.floor(remainder / ONE_MINUTE);
  remainder = remainder - minutes * ONE_MINUTE;
  var seconds = Math.floor(remainder / ONE_SECOND);
  remainder = remainder - seconds * ONE_SECOND;
  var millis = remainder;

  return (
    (hours + "").padStart(2, "0") +
    ":" +
    (minutes + "").padStart(2, "0") +
    ":" +
    (seconds + "").padStart(2, "0") +
    "," +
    (Math.floor(millis) + "").padStart(3, "0")
  );
}
