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
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();
var s3 = new AWS.S3();
var zlib = require('zlib');

/**
 * Creates the closed captions files from an Amazon Transcribe result
 * and saves them back into the captions table
 */
exports.handler = async (event, context, callback) => {
    
    console.log("[INFO] handling event: %j", event);

    try
    {
        var getObjectParams = {
            Bucket: process.env.TRANSCRIBE_BUCKET,
            Key: decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "))
        };

        var transcribeFile = path.basename(getObjectParams.Key);
        var videoId = transcribeFile.substring(0, transcribeFile.length - 5);

        console.log("[INFO] found video id: " + videoId);

        var getObjectResponse = await s3.getObject(getObjectParams).promise();

        var transcribeResponse = JSON.parse(getObjectResponse.Body.toString());

        var tweaks = await getTweaks();

        console.log("[INFO] loaded tweaks: %j", tweaks);

        var videoInfo = await getVideo(videoId);

        console.log("[INFO] get video: %j", videoInfo);

        var captions = computeCaptions(tweaks, transcribeResponse, videoInfo);

        await saveCaptions(videoId, captions);

        await updateDynamoDB(videoId, "READY", "Ready for editing");
        
        callback(null, "Successfully computed captions");       
    }
    catch (error)
    {
        console.log("[ERROR] Failed to compute captions", error);
        await updateDynamoDB(videoId, "ERRORED", "Failed to compute captions: " + error.message);
        callback(error);
    }
};

/**
 * Saves the first cut of the captions to DynamoDB
 */
async function saveCaptions(videoId, captions)
{
    try
    {
        const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
        var captionS3Parmas = {
            Bucket : transcribeBucket,
            Key : 'captions/' + videoId,
            ContentType: 'text/plain',
            Body : JSON.stringify(captions)
        }

        console.log("[INFO] Store captions into s3 %j", captionS3Parmas);
        await s3.putObject(captionS3Parmas, function(err, data) {
             if (err) console.log(err, err.stack);
             else     console.log(data);
        }).promise();        
        
    }
    catch (error)
    {
        console.log("[ERROR] Failed to save captions", error);
        throw error;
    }

}

/**
 * Process the transcribe response applying the tweaks
 */
function computeCaptions(tweaks, transcribeResponse, videoInfo)
{
    var endTime = 0.0;
    var maxLength = 50;
    var wordCount = 0;
    var maxWords = 20;
    var maxSilence = 0;
    
    console.log('[INFO] computing captions with max silence: ' + maxSilence);

    console.log('[INFO] computeCaptions transcribeResponse %j' + transcribeResponse);

    var captions = [];
    var caption = null;
    var prevCaption = null;

    var tweaksMap = new Map();

    for (var i in tweaks.tweaks)
    {
        var tweak = tweaks.tweaks[i];

        var splits = tweak.split("=");
        if (splits.length == 2)
        {
            tweaksMap.set(splits[0].toLowerCase().trim(), splits[1].trim());
        }
    }

    for (var i in transcribeResponse.results.items) {

        var item = transcribeResponse.results.items[i];

        var isPunctuation = (item.type == "punctuation");

        var startTime = Number(item.start_time);

        if (!caption)
        {
            /**
             * Start of a line with punction, just skip it
             */
            if (isPunctuation)
            {
                continue;
            }

            /**
             * Create a new caption line
             */
            caption = {
                start: Number(item.start_time),
                caption: "",
                wordConfidence: [],
                words: []
            };
        }

        
        /**
         * Merge the previous caption and current caption
         * when the word count is less than recommended and
         * the punctuation appeared or silence occurred
         */
        if (isPunctuation || ((caption.caption.length > 0) && (endTime < startTime)))
        {
            if (typeof prevCaption !== "undefined" && prevCaption !== null)
            {
                if (prevCaption.caption.length + caption.caption.length <= 15) {
                    prevCaption = captions.pop();
                    caption.start = prevCaption.start;
                    caption.caption = prevCaption.caption + caption.caption;
                    caption.wordConfidence = prevCaption.wordConfidence.concat(caption.wordConfidence);
                    caption.words = prevCaption.words.concat(caption.words);
                }
            }
            caption.end = endTime;
            captions.push(caption);

            // Reset the word count whatever the silence or punctuation
            wordCount = 0;

            if (isPunctuation)
            {
                prevCaption = null;

                // Force to end the caption when punctuation appeared
                caption = null;
                continue;
            }
            else
            {
                if ((startTime - endTime) >= 0.15)
                {
                    prevCaption = null;
                } else {
                    prevCaption = caption;
                }

                caption = {
                    start: Number(startTime),
                    caption: "",
                    wordConfidence: [],
                    words: []
                };
            }
        }

        endTime = Number(item.end_time);

        var requiresSpace = !isPunctuation && (caption.caption.length > 0) && process.env.TRANSCRIBE_LANGUAGE != 'zh-CN';
        caption.caption += requiresSpace ? " " : "";

        /**
         * Process tweaks
         * TODO handle multiple alternatives if these ever appear
         */
        var text = item.alternatives[0].content;
        var confidence = item.alternatives[0].confidence;
        var textLower = text.toLowerCase();

        if (tweaksMap.has(textLower))
        {
            text = tweaksMap.get(textLower);
        }

        if (!isPunctuation || (isPunctuation && wordCount > 0)) {
            caption.caption += text;

            // Track raw word and it's time
            caption.words.push(
              {
                w: text,
                st: item.start_time,
                et: item.end_time,
                c: parseFloat(confidence)
              }
            );
        }

        /**
         * Track raw word confidence
         */
        if (!isPunctuation)
        {
            caption.wordConfidence.push(
                {
                    w: text.toLowerCase(),
                    c: parseFloat(confidence)
                }
            );            
        }

        /**
         * Count words
         */
        wordCount += isPunctuation ? 0 : 1;

        /**
         * If we have reached a good amount of text finalise the caption
         */
        if (wordCount >= maxWords || caption.caption.length >= maxLength)
        {
            caption.end = endTime;
            prevCaption = caption;
            captions.push(caption);
            wordCount = 0;
            caption = null;
        }
    }

    /**
     * Close the last caption if required
     */
    if (caption != null)
    {
        caption.end = endTime;
        captions.push(caption);
        caption = null;
        wordCount = 0;
    }
    return captions;
}

/**
 * Fetches the tweaks from DynamoDB
 */
async function getTweaks()
{
    try
    {

        var getItemParams = {
            TableName: process.env.DYNAMO_CONFIG_TABLE,
            Key: 
            {
                "configId" : {"S": "tweaks"},
            },
        };

        console.log("[INFO] loading tweaking using request: %j", getItemParams);  
        
        var getItemResponse = await dynamoDB.getItem(getItemParams).promise();
        
        console.log("[INFO] got response from Dyanmo: %j", getItemResponse);

        if (getItemResponse.Item)
        {
            return JSON.parse(getItemResponse.Item.configValue.S);
        }
        else
        {
            return { 
                "tweaks": [ ]
            };  
        }        
    }
    catch (error)
    {
        console.log("Failed to load tweaks from DynamoDB", error);
        throw error;
    }   
}

/**
 * Fetch the video info from DynamoDB
 */
async function getVideo(videoId)
{
    try
    {

        var getParams = {
            TableName: process.env.DYNAMO_VIDEO_TABLE,
            Key: 
            {
                "videoId" : {"S": videoId},
            },
        };

        console.log("[INFO] loading video using request: %j", getParams);  
        
        var getResponse = await dynamoDB.getItem(getParams).promise();
        
        console.log("[INFO] got response from Dyanmo: %j", getResponse);

        if (getResponse.Item)
        {
            var videoInfo = mapper(getResponse.Item);
            return videoInfo;
        }
        else
        {
            throw new Error('Video not found');
        }        
    }
    catch (error)
    {
        console.log("Failed to get video from DynamoDB", error);
        return {};
    }   
}

/**
 * Update Dynamo status and statusText for a video
 */
async function updateDynamoDB(videoId, status, statusText)
{
    try
    {
        var params = {
            TableName: process.env.DYNAMO_VIDEO_TABLE,
            Key: 
            {
                "videoId" : { "S": videoId }
            },
            UpdateExpression: "SET #status = :status, #statusText = :statusText",
            ExpressionAttributeNames: {
                "#status": "status",
                "#statusText": "statusText"
            },
            ExpressionAttributeValues: {
                ":status": {
                    S: status
                },               
                ":statusText": {
                    S: statusText
                }
            },
            ReturnValues: "NONE"            
        };

        var result = await dynamoDB.updateItem(params).promise();

        console.log("[INFO] successfully updated DynamoDB status");
    }
    catch (error)
    {
        console.log("[ERROR] to update DynamoDB status", error);
        throw error;
    }
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
