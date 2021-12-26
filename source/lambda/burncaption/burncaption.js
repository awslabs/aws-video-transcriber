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
    var videoId = event.pathParameters.videoId;
    var getVideoResponse = await getVideoInfo(videoId);
    var body = JSON.parse(event.body);

    var language = body.language;
    var translated = body.translated;
    if (getVideoResponse.Item) {
      var video = mapper(getVideoResponse.Item);
      await prepareSrtCaptions(videoId, language, translated);

      await burnCaptions(videoId, video, language, translated);

      const response = {
        statusCode: 200,
        headers: responseHeaders,
        body: JSON.stringify({ video: video }),
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

async function prepareSrtCaptions(videoId, language, translated) {
  const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
  var captionsKey = "";
  var inputCaptionsKey = "burnedcaptions/" + videoId + ".srt";
  if (translated == "true") {
    captionsKey = "captions/" + videoId + "_" + language + ".json";
    inputCaptionsKey = "burnedcaptions/" + videoId + "_" + language + ".srt";
  } else {
    captionsKey = "captions/" + videoId + ".json";
    inputCaptionsKey = "burnedcaptions/" + videoId + ".srt";
  }
  var captionS3Params = {
    Bucket: transcribeBucket,
    Key: captionsKey,
  };
  var captionsObject = await s3.getObject(captionS3Params).promise();
  captionsStr = captionsObject.Body.toString();
  var captions = JSON.parse(captionsStr);
  var srtCaptions = await exportCaptions("srt", captions, language);

  await s3
    .putObject({
      Bucket: transcribeBucket,
      Key: inputCaptionsKey,
      ContentType: "binary/octet-stream",
      Body: srtCaptions,
    })
    .promise();
}

async function burnCaptions(videoId, video, language, translated) {
  const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
  var inputCaptionsKey = "";
  var outputNameModifier = "";
  if (translated == "true") {
    inputCaptionsKey = "burnedcaptions/" + videoId + "_" + language + ".srt";
    outputNameModifier = "_" + videoId + "_translated";
  } else {
    inputCaptionsKey = "burnedcaptions/" + videoId + ".srt";
    outputNameModifier = "_" + videoId + "_";
  }

  var inputCaptionsS3Path = "s3://" + transcribeBucket + "/" + inputCaptionsKey;
  var inputVideoS3Path = video["s3VideoPath"];
  var outputVideoS3Path =
    "s3://" +
    process.env.OUTPUT_VIDEO_BUCKET +
    "/" +
    process.env.OUTPUT_VIDEO_KEY_PREFIX +
    "/";

  var mediaConvertEndpoint = await getMediaConvertEndpoint();
  console.log("INFO mediaConvertEndpoint is ", mediaConvertEndpoint);
  AWS.config.mediaconvert = { endpoint: mediaConvertEndpoint };

  var mediaConvertRole = process.env.MEDIACONVERT_ROLE;
  var mediaConvertQueue = process.env.MEDIACONVERT_QUEUE;
  var mediaConvertParams = {
    Queue: mediaConvertQueue,
    UserMetadata: {},
    Role: mediaConvertRole,
    Settings: {
      TimecodeConfig: {
        Source: "ZEROBASED",
      },
      OutputGroups: [
        {
          Name: "File Group",
          Outputs: [
            {
              ContainerSettings: {
                Container: "MP4",
                Mp4Settings: {},
              },
              VideoDescription: {
                CodecSettings: {
                  Codec: "H_264",
                  H264Settings: {
                    MaxBitrate: 5000000,
                    RateControlMode: "QVBR",
                    SceneChangeDetect: "TRANSITION_DETECTION",
                  },
                },
              },
              AudioDescriptions: [
                {
                  AudioSourceName: "Audio Selector 1",
                  CodecSettings: {
                    Codec: "AAC",
                    AacSettings: {
                      Bitrate: 96000,
                      CodingMode: "CODING_MODE_2_0",
                      SampleRate: 48000,
                    },
                  },
                },
              ],
              NameModifier: outputNameModifier,
              CaptionDescriptions: [
                {
                  CaptionSelectorName: "Captions Selector 1",
                  DestinationSettings: {
                    DestinationType: "BURN_IN",
                    BurninDestinationSettings: {
                      Alignment: "CENTERED",
                      OutlineSize: 3,
                      FontOpacity: 255,
                      FontColor: "WHITE",
                      BackgroundColor: "NONE",
                      OutlineColor: "BLACK",
                    },
                  },
                  LanguageCode: "ZHO",
                },
              ],
            },
          ],
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination: outputVideoS3Path,
            },
          },
        },
      ],
      Inputs: [
        {
          AudioSelectors: {
            "Audio Selector 1": {
              DefaultSelection: "DEFAULT",
            },
          },
          VideoSelector: {},
          TimecodeSource: "ZEROBASED",
          CaptionSelectors: {
            "Captions Selector 1": {
              SourceSettings: {
                SourceType: "SRT",
                FileSourceSettings: {
                  SourceFile: inputCaptionsS3Path,
                },
              },
            },
          },
          FileInput: inputVideoS3Path,
        },
      ],
    },
    AccelerationSettings: {
      Mode: "DISABLED",
    },
    StatusUpdateInterval: "SECONDS_60",
    Priority: 0,
  };

  console.log(
    "start to create media convert job, params: %j",
    mediaConvertParams
  );
  var endpointPromise;
  if (process.env.REGION === "cn-north-1") {
    endpointPromise = new AWS.MediaConvert({
      apiVersion: "2017-08-29",
      region: "cn-northwest-1",
    })
      .createJob(mediaConvertParams)
      .promise();
  } else {
    endpointPromise = new AWS.MediaConvert({ apiVersion: "2017-08-29" })
      .createJob(mediaConvertParams)
      .promise();
  }

  console.log("media convert job created");

  // Handle promise's fulfilled/rejected status
  await endpointPromise.then(
    function (data) {
      console.log("Job created! ", data);
    },
    function (err) {
      console.log("Error", err);
    }
  );
}

async function getMediaConvertEndpoint() {
  console.log("INFO start getMediaConvertEndpoint");

  var getParams = {
    TableName: process.env.DYNAMO_CONFIG_TABLE,
    Key: {
      configId: { S: "mediaConvertEndpoint" },
    },
  };

  console.log("[INFO] calling getItem with parameters: %j", getParams);
  var getItemResponse = await dynamoDB.getItem(getParams).promise();
  console.log("[INFO] getItem response from Dynamo: %j", getItemResponse);
  if (getItemResponse.Item) {
    console.log(
      "[INFO] get mediaConvert endpoint from DDB: ",
      getItemResponse.Item.endpointValue.S
    );
    return getItemResponse.Item.endpointValue.S;
  } else {
    var mediaConvertParams = {
      MaxResults: 0,
    };
    // Create a promise on a MediaConvert object
    var endpointPromise;
    if (
      process.env.REGION === "cn-northwest-1" ||
      process.env.REGION === "cn-north-1"
    ) {
      endpointPromise = new AWS.MediaConvert({
        apiVersion: "2017-08-29",
        endpoint:
          "https://subscribe.mediaconvert.cn-northwest-1.amazonaws.com.cn",
        region: "cn-northwest-1",
      })
        .describeEndpoints(mediaConvertParams)
        .promise();
    } else {
      endpointPromise = new AWS.MediaConvert({ apiVersion: "2017-08-29" })
        .describeEndpoints(mediaConvertParams)
        .promise();
    }
    var mediaConvertEndpoint;
    console.log("INFO generate endpointPromise");
    await endpointPromise.then(
      function (data) {
        console.log("INFO endpointPromise success");
        console.log("Your MediaConvert endpoint is ", data.Endpoints);
        mediaConvertEndpoint = data.Endpoints[0].Url;
      },
      function (err) {
        console.log("Error", err);
      }
    );
    console.log("INFO getMediaConvertEndpoint end %s", mediaConvertEndpoint);

    var updateParams = {
      TableName: process.env.DYNAMO_CONFIG_TABLE,
      Key: {
        configId: { S: "mediaConvertEndpoint" },
      },
      UpdateExpression: "SET #endpointValue = :endpointValue",
      ExpressionAttributeNames: {
        "#endpointValue": "endpointValue",
      },
      ExpressionAttributeValues: {
        ":endpointValue": {
          S: mediaConvertEndpoint,
        },
      },
      ReturnValues: "NONE",
    };

    await dynamoDB.updateItem(updateParams).promise();

    console.log("[INFO] successfully updated DynamoDB status");
    return mediaConvertEndpoint;
  }
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
