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

var path = require("path");
var AWS = require("aws-sdk");
var { default: srtParser2 } = require("srt-parser-2");
AWS.config.update({ region: process.env.REGION });
var dynamoDB = new AWS.DynamoDB();
var s3 = new AWS.S3();

/**
 * Creates the closed captions files from an Amazon Transcribe result
 * and saves them back into the captions table
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] handling event: %j", event);

  try {
    var getObjectParams = {
      Bucket: process.env.TRANSCRIBE_BUCKET,
      Key: decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
      ),
    };
    var transcribeFile = path.basename(getObjectParams.Key);
    var videoId = transcribeFile.substring(0, transcribeFile.length - 5);

    getObjectParams.Key = getObjectParams.Key.replace('.json', '.srt');

    try {
      await s3.headObject(getObjectParams).promise();
    } catch (err) {
      console.log("the object is not exist " + err.code);
      await updateDynamoDB(videoId, "ERRORED", "Amazon Transcribe service cannot create srt file, please check Amazon Transcribe service");
      callback(err);
    }

    var getObjectResponse = await s3.getObject(getObjectParams).promise();

    var srtParser = new srtParser2();

    console.log(
      "getObjectResponse body: %s",
      getObjectResponse.Body.toString()
    );
    var captionArray = srtParser.fromSrt(getObjectResponse.Body.toString());

    console.log("captionJson: %j", captionArray);

    // var transcribeResponse = JSON.parse(captionJson);

    var tweaks = await getTweaks();

    console.log("[INFO] loaded tweaks: %j", tweaks);

    var videoInfo = await getVideo(videoId);

    console.log("[INFO] get video: %j", videoInfo);

    computeCaptions(tweaks, captionArray);

    await saveCaptions(videoId, captionArray);

    await updateDynamoDB(videoId, "READY", "Ready for editing");

    callback(null, "Successfully computed captions");
  } catch (error) {
    console.log("[ERROR] Failed to compute captions", error);
    await updateDynamoDB(
      videoId,
      "ERRORED",
      "Failed to compute captions: " + error.message
    );
    callback(error);
  }
};

/**
 * Saves the first cut of the captions to DynamoDB
 */
async function saveCaptions(videoId, captions) {
  try {
    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var captionS3Parmas = {
      Bucket: transcribeBucket,
      Key: "captions/" + videoId + ".json",
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

/**
 * Process the transcribe response applying the tweaks
 */
function computeCaptions(tweaks, captionArray) {
  var tweaksMap = new Map();

  for (var i in tweaks.tweaks) {
    var tweak = tweaks.tweaks[i];

    var splits = tweak.split("=");
    if (splits.length == 2) {
      tweaksMap.set(splits[0].trim(), splits[1].trim());
    }
  }

  for (var i in captionArray) {
    /**
     * Process tweaks
     * TODO handle multiple alternatives if these ever appear
     */
    for (let [key, value] of tweaksMap) {
      const searchRegExp = new RegExp(key, "g");
      captionArray[i].text = captionArray[i].text.replace(searchRegExp, value);
    }
  }
  return;
}

/**
 * Fetches the tweaks from DynamoDB
 */
async function getTweaks() {
  try {
    var getItemParams = {
      TableName: process.env.DYNAMO_CONFIG_TABLE,
      Key: {
        configId: { S: "tweaks" },
      },
    };

    console.log("[INFO] loading tweaking using request: %j", getItemParams);

    var getItemResponse = await dynamoDB.getItem(getItemParams).promise();

    console.log("[INFO] got response from Dyanmo: %j", getItemResponse);

    if (getItemResponse.Item) {
      return JSON.parse(getItemResponse.Item.configValue.S);
    } else {
      return {
        tweaks: [],
      };
    }
  } catch (error) {
    console.log("Failed to load tweaks from DynamoDB", error);
    throw error;
  }
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
 * Update Dynamo status and statusText for a video
 */
async function updateDynamoDB(videoId, status, statusText) {
  try {
    var params = {
      TableName: process.env.DYNAMO_VIDEO_TABLE,
      Key: {
        videoId: { S: videoId },
      },
      UpdateExpression: "SET #status = :status, #statusText = :statusText",
      ExpressionAttributeNames: {
        "#status": "status",
        "#statusText": "statusText",
      },
      ExpressionAttributeValues: {
        ":status": {
          S: status,
        },
        ":statusText": {
          S: statusText,
        },
      },
      ReturnValues: "NONE",
    };

    var result = await dynamoDB.updateItem(params).promise();

    console.log("[INFO] successfully updated DynamoDB status");
  } catch (error) {
    console.log("[ERROR] to update DynamoDB status", error);
    throw error;
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
