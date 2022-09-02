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
var uuidv4 = require("uuid/v4");
var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.REGION });
var dynamoDB = new AWS.DynamoDB();

/**
 * Invokes MediaConvert to extract MP3 audio and tracks status in DynamoDB
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] handling event: %j", event);

  var params = {};

  try {
    params.dynamoVideoTable = process.env.DYNAMO_VIDEO_TABLE;
    //check request from api or s3
    if (event.Records != null && event.Records[0].hasOwnProperty("s3")) {
      /**
       * Minimum parameters to check for prior processings
       */
      params.inputBucket = decodeURIComponent(
        event.Records[0].s3.bucket.name.replace(/\+/g, " ")
      );
      params.inputKey = decodeURIComponent(
        event.Records[0].s3.object.key.replace(/\+/g, " ")
      );
      params.videoName = path.basename(params.inputKey);
      params.inputS3Path = "s3://" + params.inputBucket + "/" + params.inputKey;
      params.videoNamePrefix = params.videoName.substring(
        0,
        params.videoName.length - 4
      );
      if (params.inputKey === "videos/") {
        callback(null, "Skipping folder");
        return;
      }
    } else {
      // request is from API Gateway
      var body = JSON.parse(event.body);
      params.videoName = body.videoName;
      params.inputS3Path = body.inputS3Path;
      params.videoNamePrefix = params.videoName.substring(
        0,
        params.videoName.length - 4
      );
      params.videoId = body.videoId;
    }

    /**
     * Check for an existing video and use an existing video
     * id if provided
     */
    await checkForPriorProcessing(params);

    /**
     * Compute remaining params perhaps with an existing video id
     */
    computeRemainingParams(event, params);

    /**
     * Fail if this is an unknown video type
     */
    checkVideoType(params);

    /**
     * Extract MP3 audio for Transcribe
     */
    await extractAudio(params);

    /**
     * Update the Dynamo status for successful processing steps
     */
    await updateDynamoDB(params);

    var responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
      "Content-Type": "application/json",
    };

    var responseBody = {
      message: "successfully",
    };

    const response = {
      statusCode: 200,
      body: JSON.stringify(responseBody),
      headers: responseHeaders,
    };

    callback(null, response);
  } catch (error) {
    console.log("[ERROR] failed to extract audio", error);
    params.status = "ERRORED";
    params.statusText = "Failed to process audio: " + error.message;
    await updateDynamoDB(params);
    callback(error);
  }
};

/**
 * Compute remaining processing parameters now we know
 * the video id for sure
 */
function computeRemainingParams(event, params) {
  var outputAudioBucket = process.env.OUTPUT_AUDIO_BUCKET;

  var outputAudioKeyPrefix = process.env.OUTPUT_AUDIO_KEY_PREFIX;

  /**
   * If this is the first time through create a new videoId
   */
  if (params.videoId == null) {
    params.videoId = uuidv4();
  }

  params.mediaConvertRole = process.env.MEDIACONVERT_ROLE;
  params.mediaConvertQueue = process.env.MEDIACONVERT_QUEUE;

  params.outputAudioBucket = outputAudioBucket;
  params.outputAudioKeyPrefix = outputAudioKeyPrefix;
  params.outputAudioS3Path =
    "s3://" +
    outputAudioBucket +
    "/" +
    outputAudioKeyPrefix +
    "/" +
    params.videoNamePrefix +
    "_" +
    params.videoId +
    ".mp4";

  params.dynamoVideoTable = process.env.DYNAMO_VIDEO_TABLE;

  params.status = "PROCESSING";
  params.statusText = "Extracting audio";

  /**
   * Check format and only accept MP4, MKV and MOV files
   */
  if (params.videoName.toLowerCase().endsWith(".mp4")) {
    console.log(
      "[INFO] found MP4 input video file that requires transcoding: %s",
      params.videoName
    );
    params.videoType = "MP4";
  } else if (params.videoName.toLowerCase().endsWith(".mkv")) {
    console.log(
      "[INFO] found MKV input video file that requires transcoding: %s",
      params.videoName
    );
    params.videoType = "MKV";
  } else if (params.videoName.toLowerCase().endsWith(".mov")) {
    console.log(
      "[INFO] found MOV input video file that requires transcoding: %s",
      params.videoName
    );
    params.videoType = "MOV";
  } else {
    console.log(
      "[ERROR] found incompatible input video file, skipping: %s",
      params.videoName
    );
    params.videoType = "UNKNOWN";
  }

  console.log("[INFO] computed initial parameters: %j", params);
}

/**
 * Checks for prior processing by inspecting the DynamoDB
 * videos table
 */
async function checkForPriorProcessing(params) {
  try {
    if (params.videoId != null) {
      var getParams = {
        TableName: params.dynamoVideoTable,
        Key: {
          videoId: { S: params.videoId },
        },
      };
      console.log("[INFO] loading video using request: %j", getParams);
      var response = await dynamoDB.getItem(getParams).promise();
      console.log(
        "[INFO] got successful response from GSI query: %j",
        response
      );
      if (response.Item) {
        params.videoId = response.Item.videoId.S;
        params.videoName = response.Item.name.S;
        params.language = response.Item.language.S;
        params.vocabulary = response.Item.vocabulary.S;
  
        if (response.Item.description) {
          params.videoDescription = response.Item.description.S;
        }
      }      
    } else {
      var queryParams = {
        TableName: params.dynamoVideoTable,
        IndexName: "s3VideoPathIndex",
        KeyConditionExpression: "s3VideoPath = :s3_video_path",
        ExpressionAttributeValues: {
          ":s3_video_path": { S: params.inputS3Path },
        },
      };
      console.log(
        "[INFO] checking DynamoDB for existing video using: %j",
        queryParams
      );
      var response = await dynamoDB.query(queryParams).promise(); 
      console.log(
        "[INFO] got successful response from GSI query: %j",
        response
      );
      if (response.Items && response.Items[0]) {
        params.videoId = response.Items[0].videoId.S;
        params.videoName = response.Items[0].name.S;
        params.language = response.Items[0].language.S;
        params.vocabulary = response.Items[0].vocabulary.S;
  
        if (response.Items[0].description) {
          params.videoDescription = response.Items[0].description.S;
        }
      }          
    }

  } catch (error) {
    console.log("[ERROR] failed to check if video exists in DynamoDB", error);
    throw error;
  }
}

/**
 * Fail if the video type is UNKNOWN
 */
function checkVideoType(params) {
  if (params.videoType === "UNKNOWN") {
    throw new Error("Unhandled video type detected");
  }
}

/**
 * Queues an audio extraction job in elastic transcoder
 */
async function extractAudio(params) {
  console.log("extractAudio input params:", params);
  var mediaConvertEndpoint = await getMediaConvertEndpoint();
  console.log("endpoint: ", mediaConvertEndpoint);

  AWS.config.mediaconvert = { endpoint: mediaConvertEndpoint };

  var mediaConvertParams = {
    Queue: params.mediaConvertQueue,
    UserMetadata: {},
    Role: params.mediaConvertRole,
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
                Container: "RAW"
              },
              AudioDescriptions: [
                {
                  AudioSourceName: "Audio Selector 1",
                  CodecSettings: {
                    Codec: "MP3",
                    Mp3Settings: {
                      Channels: 1,
                      RateControlMode: "VBR",
                      VbrQuality: 0
                    }
                  },
                  RemixSettings: {
                    ChannelMapping: {
                      OutputChannels: [
                        {
                          InputChannelsFineTune: [
                            6,
                            6
                          ]
                        }
                      ]
                    },
                    ChannelsIn: 2,
                    ChannelsOut: 1
                  }                  
                },
              ],
              Extension: "mp3",
              NameModifier: "_" + params.videoId,
            },
          ],
          OutputGroupSettings: {
            Type: "FILE_GROUP_SETTINGS",
            FileGroupSettings: {
              Destination:
                "s3://" +
                params.outputAudioBucket +
                "/" +
                params.outputAudioKeyPrefix +
                "/",
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
          FilterEnable: "FORCE",
          DeblockFilter: "ENABLED",
          DenoiseFilter: "ENABLED",          
          TimecodeSource: "ZEROBASED",
          FileInput: params.inputS3Path,
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

/**
 * Update the DynamoDB Table with the latest status
 */
async function updateDynamoDB(params) {
  console.log("[INFO] saving item to DynamoDB using params: %j", params);

  var putParams = {
    TableName: params.dynamoVideoTable,
    Item: {
      videoId: { S: params.videoId },
      name: { S: params.videoName },
      s3VideoPath: { S: params.inputS3Path },
      s3AudioPath: { S: params.outputAudioS3Path },
      status: { S: params.status },
      language: { S: params.language || process.env.TRANSCRIBE_LANGUAGE },
      vocabulary: { S: params.vocabulary || '' },
      statusText: { S: params.statusText },
      processedDate: { S: new Date().toISOString() },
    },
  };

  // Preserve description
  if (params.videoDescription) {
    putParams.Item.description = { S: params.videoDescription };
  }

  try {
    console.log(
      "[INFO] putting item into Dynamo with parameters: %j",
      putParams
    );
    const putData = await dynamoDB.putItem(putParams).promise();
    console.log("[INFO] successfully put item with response: %j", putData);
  } catch (error) {
    console.log("[ERROR] failed to put video item into DynamoDB", error);
    throw error;
  }
}
