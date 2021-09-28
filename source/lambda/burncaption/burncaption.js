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

var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();
var s3 = new AWS.S3();

/**
 * Burn captions into videos.
 */
exports.handler = async (event, context, callback) => {

    console.log('[INFO] got event: %j', event);

    var responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
    };

    try
    {
        var videoId = event.pathParameters.videoId;
        var getVideoResponse = await getVideoInfo(videoId)

        if (getVideoResponse.Item)
        {
            var video = mapper(getVideoResponse.Item);
            await prepareSrtCaptions(videoId);

            await burnCaptions(videoId, video);
            
            const response = {
                statusCode: 200,
                headers: responseHeaders,
                body: JSON.stringify({  "video": video })
            }; 

            console.log("[INFO] made response: %j", response);           

            callback(null, response);
        }
        else
        {
            throw new Error('Video not found');
        }
    }
    catch (error)
    {
        console.log("[ERROR] Failed to burn in captions with uploaded video", error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  
                "message": "Failed to burn in captions: " + error 
            })
        };
        callback(null, response);
    }
};

async function getVideoInfo(videoId)
{
    getParams = {
        TableName: process.env.DYNAMO_VIDEO_TABLE,
        Key: 
        {
            'videoId' : { 'S': videoId },
        },
    };

    console.log("[INFO] calling getItem with parameters: %j", getParams);
    var getVideoResponse = await dynamoDB.getItem(getParams).promise();
    console.log("[INFO] getItem response from Dynamo: %j", getVideoResponse); 
    return getVideoResponse;
}

async function prepareSrtCaptions(videoId)
{
    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var captionS3Params = {
        Bucket : transcribeBucket,
        Key : 'captions/' + videoId          
    }
    var captionsObject = await s3.getObject(captionS3Params).promise(); 
    captionsStr = captionsObject.Body.toString();
    var captions = JSON.parse(captionsStr);
    var srtCaptions = await exportCaptions("srt", captions);

    var inputCaptionsKey = 'srt/' + videoId + '.srt';
    await s3.putObject({
        Bucket: transcribeBucket,
        Key: inputCaptionsKey,
        ContentType: 'binary/octet-stream',
        Body: srtCaptions
      }).promise();
}

async function burnCaptions(videoId, video)
{
    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var inputCaptionsKey = 'srt/' + videoId + '.srt';

    var inputCaptionsS3Path = 's3://' + transcribeBucket + '/' + inputCaptionsKey;
    var inputVideoS3Path = video['s3VideoPath'];
    var outputVideoS3Path = 's3://' + process.env.OUTPUT_VIDEO_BUCKET + '/tmp/'

    var mediaConvertEndpoint = await getMediaConvertEndpoint();
    console.log('INFO mediaConvertEndpoint is ', mediaConvertEndpoint);
    AWS.config.mediaconvert = {endpoint : mediaConvertEndpoint};

    var mediaConvertRole = process.env.MEDIACONVERT_ROLE;
    var mediaConvertQueue = process.env.MEDIACONVERT_QUEUE
    var mediaConvertParams = {
        "Queue": mediaConvertQueue,
        "UserMetadata": {},
        "Role": mediaConvertRole,
        "Settings": {
            "TimecodeConfig": {
              "Source": "ZEROBASED"
            },
            "OutputGroups": [
              {
                "Name": "File Group",
                "Outputs": [
                  {
                    "ContainerSettings": {
                      "Container": "MP4",
                      "Mp4Settings": {}
                    },
                    "VideoDescription": {
                      "CodecSettings": {
                        "Codec": "H_264",
                        "H264Settings": {
                          "MaxBitrate": 5000000,
                          "RateControlMode": "QVBR",
                          "SceneChangeDetect": "TRANSITION_DETECTION"
                        }
                      }
                    },
                    "AudioDescriptions": [
                      {
                        "AudioSourceName": "Audio Selector 1",
                        "CodecSettings": {
                          "Codec": "AAC",
                          "AacSettings": {
                            "Bitrate": 96000,
                            "CodingMode": "CODING_MODE_2_0",
                            "SampleRate": 48000
                          }
                        }
                      }
                    ],
                    "NameModifier": "_" + videoId,
                    "CaptionDescriptions": [
                      {
                        "CaptionSelectorName": "Captions Selector 1",
                        "DestinationSettings": {
                          "DestinationType": "BURN_IN",
                          "BurninDestinationSettings": {
                            "Alignment": "CENTERED",
                            "OutlineSize": 3,
                            "FontOpacity": 255,
                            "FontColor": "WHITE",
                            "BackgroundColor": "NONE",
                            "OutlineColor": "BLACK"
                          }
                        },
                        "LanguageCode": "ZHO"
                      }
                    ]
                  }
                ],
                "OutputGroupSettings": {
                  "Type": "FILE_GROUP_SETTINGS",
                  "FileGroupSettings": {
                    "Destination": outputVideoS3Path
                  }
                }
              }
            ],
            "Inputs": [
              {
                "AudioSelectors": {
                  "Audio Selector 1": {
                    "DefaultSelection": "DEFAULT"
                  }
                },
                "VideoSelector": {},
                "TimecodeSource": "ZEROBASED",
                "CaptionSelectors": {
                  "Captions Selector 1": {
                    "SourceSettings": {
                      "SourceType": "SRT",
                      "FileSourceSettings": {
                        "SourceFile": inputCaptionsS3Path
                      }
                    }
                  }
                },
                "FileInput": inputVideoS3Path
              }
            ]
          },
          "AccelerationSettings": {
            "Mode": "DISABLED"
          },
          "StatusUpdateInterval": "SECONDS_60",
          "Priority": 0
        };
    
    console.log("start to create media convert job, params: %j", mediaConvertParams);
    var endpointPromise;
    if (process.env.REGION === "cn-north-1")
    {
        endpointPromise = new AWS.MediaConvert({apiVersion: '2017-08-29', region: "cn-northwest-1"}).createJob(mediaConvertParams).promise();
    }
    else
    {
        endpointPromise = new AWS.MediaConvert({apiVersion: '2017-08-29'}).createJob(mediaConvertParams).promise();
    }

    console.log("media convert job created");
    
    // Handle promise's fulfilled/rejected status
    await endpointPromise.then(
        function(data) {
            console.log("Job created! ", data);
        },
        function(err) {
            console.log("Error", err);
        }
    );
}

async function getMediaConvertEndpoint()
{
    console.log('INFO start getMediaConvertEndpoint');
    var mediaConvertParams = {
      MaxResults: 0
    };    
    // Create a promise on a MediaConvert object
    var endpointPromise;
    if (process.env.REGION === "cn-northwest-1" || process.env.REGION === "cn-north-1")
    {
        endpointPromise = new AWS.MediaConvert({apiVersion: '2017-08-29', endpoint: 'https://subscribe.mediaconvert.cn-northwest-1.amazonaws.com.cn', region: 'cn-northwest-1'}).describeEndpoints(mediaConvertParams).promise();
    } 
    else 
    {
        endpointPromise = new AWS.MediaConvert({apiVersion: '2017-08-29'}).describeEndpoints(mediaConvertParams).promise();
    }
    var mediaConvertEndpoint;
    console.log('INFO generate endpointPromise');
    await endpointPromise.then(
      function(data) {
        console.log('INFO endpointPromise success');
        console.log("Your MediaConvert endpoint is ", data.Endpoints);
        mediaConvertEndpoint = data.Endpoints[0].Url;
      },
      function(err) {
        console.log("Error", err);
      }
    ); 
    console.log('INFO getMediaConvertEndpoint end %s', mediaConvertEndpoint);
    return mediaConvertEndpoint;

}

async function exportCaptions(format, captions)
{
    var srt = '';

    var index = 1;

    for (var i in captions)
    {
        var caption = captions[i];

        if (caption.caption.trim() === '')
        {
          continue;
        }
        
        srt += index + '\n';
        srt += formatTimeSRT(caption.start) + ' --> ' + formatTimeSRT(caption.end) + '\n';
        srt += caption.caption + '\n\n';
        index++;
    }

    return srt;
}

/**
 * Format an SRT timestamp in HH:MM:SS,mmm
 */
function formatTimeSRT(timeSeconds)
{
    const ONE_HOUR = 60 * 60;
    const ONE_MINUTE = 60;
    var hours = Math.floor(timeSeconds / ONE_HOUR);
    var remainder = timeSeconds - (hours * ONE_HOUR);
    var minutes = Math.floor(remainder / 60);
    remainder = remainder - (minutes * ONE_MINUTE);
    var seconds = Math.floor(remainder);
    remainder = remainder - seconds;
    var millis = remainder;

    return (hours + '').padStart(2, '0') + ':' +
            (minutes + '').padStart(2, '0') + ':' +
            (seconds + '').padStart(2, '0') + ',' +
            (Math.floor(millis * 1000) + '').padStart(3, '0');
}


/**
 * Mapper which flattens item keys for 'S' types
 */
function mapper(data) {
    
    let S = "S";

    if (isObject(data)) 
    {
        let keys = Object.keys(data);
        while (keys.length) 
        {
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
