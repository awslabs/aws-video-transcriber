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
var translate = new AWS.Translate();
var s3 = new AWS.S3();

/**
 * Burn captions into videos.
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] got event: %j", event);

  var responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json",
  };

  try {
    // var body = JSON.parse(event.body);
    var targetLanguage = event.targetLanguage;
    var videoId = event.videoId;

    var getVideoResponse = await getVideoInfo(videoId);

    if (getVideoResponse.Item) {
      var videoInfo = mapper(getVideoResponse.Item);

      var sourceLanguage = convertToTranslateLanguageCode(videoInfo.language);

      const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
      var captionS3Params = {
        Bucket: transcribeBucket,
        Key: "captions/" + videoId + ".json",
      };
      var captionsObject = await s3.getObject(captionS3Params).promise();

      captionsStr = captionsObject.Body.toString();

      var captions = JSON.parse(captionsStr);

      await transcribePromisePool(10, captions, sourceLanguage, targetLanguage)
        .then(function (values) {
          console.log('all promise are resolved')
          for (var i in captions) {
            captions[i].text = escapeHtml(values[i].TranslatedText);
          }
        }).catch(function (reason) {
          throw new Error("Translate Promise failed reason: ", reason);
        })

      await saveCaptions(videoId, captions, targetLanguage);

      await updateDynamoDB(videoId, targetLanguage);

      const response = {
        statusCode: 200,
        headers: responseHeaders,
      };

      console.log("[INFO] made response: %j", response);

      callback(null, response);
    } else {
      throw new Error("Video not found");
    }
  } catch (error) {
    console.log("[ERROR] Failed to translate captions", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to translate captions: " + error,
      }),
    };
    callback(null, response);
  }
};

async function transcribePromisePool(poolLimit, captions, sourceLanguage, targetLanguage) {
  let i = 0;
  const ret = [];
  const executing = [];
  const enqueue = function () {
    if (i === captions.length) {
      return Promise.resolve();
    }
    var caption = captions[i++];
    var captionText = caption.text;
    // Handle the case that empty captionText will cause translation error.
    if (!captionText || captionText.length === 0) {
      var captionText = ' ';
    }

    var params = {
      SourceLanguageCode: sourceLanguage /* required */,
      TargetLanguageCode: targetLanguage /* required */,
      Text: captionText,
    };

    const p = translate.translateText(params).promise();
    ret.push(p);

    const e = p.then(() => executing.splice(executing.indexOf(e), 1));
    executing.push(e);

    let r = Promise.resolve();
    if (executing.length >= poolLimit) {
      r = Promise.race(executing);
    }

    return r.then(() => enqueue());
  };
  return enqueue().then(() => Promise.all(ret));
}

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

/**
 * Saves the first cut of the captions to DynamoDB
 */
async function saveCaptions(videoId, captions, language) {
  try {
    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var captionS3Parmas = {
      Bucket: transcribeBucket,
      Key: "captions/" + videoId + "_" + language + ".json",
      ContentType: "text/plain",
      Body: JSON.stringify(captions),
    };

    console.log("[INFO] Store captions into s3 %j", captionS3Parmas);
    await s3
      .putObject(captionS3Parmas, function (err, data) {
        if (err) console.log(err, err.stack);
        else console.log(data);
      })
      .promise();
  } catch (error) {
    console.log("[ERROR] Failed to save captions", error);
    throw error;
  }
}

function convertToTranslateLanguageCode(transcribeLanguageCode) {
  switch (transcribeLanguageCode) {
    case "zh-CN":
      var translateLanguageCode = transcribeLanguageCode.substring(0, 2);
      console.log("Source language code: ", translateLanguageCode);
      return translateLanguageCode;
    default:
      var translateLanguageCode = transcribeLanguageCode.substring(0, 2);
      console.log("Source language code: ", translateLanguageCode);
      return translateLanguageCode;
  }
}

/**
 * Update Dynamo status for a video
 */
async function updateDynamoDB(videoId, targetLanguage) {
  try {
    var updateParams = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
      UpdateExpression: "SET #translatedLanguage = :translatedLanguage",
      ExpressionAttributeNames: {
        "#translatedLanguage": "translatedLanguage",
      },
      ExpressionAttributeValues: {
        ":translatedLanguage": {
          S: targetLanguage,
        },
      },
      ReturnValues: "NONE",
    };

    await dynamoDB.updateItem(updateParams).promise();

    console.log("[INFO] successfully updated DynamoDB status");
  } catch (error) {
    console.log("[ERROR] to update DynamoDB status", error);
    throw error;
  }
}

function escapeHtml(string) {
  var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
  };
  return String(string).replace(/[&<>`=\/]/g, function (s) {
    return entityMap[s];
  });
}
