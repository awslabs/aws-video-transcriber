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

var AWS = require('aws-sdk');
AWS.config.update({region: process.env.REGION});  
var s3 = new AWS.S3();

/**
 * Saves captions to Dynamo
 */
exports.handler = async (event, context, callback) => {

    console.log("Event: %j", event);

    var responseHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
        'Content-Type': 'application/json'
    }; 

    try
    {
        var videoId = event.pathParameters.videoId;

        var body = JSON.parse(event.body);

        var captionIndex = body.captionIndex;
        var wordIndex = body.wordIndex;
        var words = body.words;
        var type = body.type;
        const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
        var captionS3Params = {
            Bucket : transcribeBucket,
            Key : 'captions/' + videoId          
        }
        var captionsObject = await s3.getObject(captionS3Params).promise(); 
        
        var captionsStr = captionsObject.Body.toString();
        
        var captionData = JSON.parse(captionsStr);

        if (type == "MODIFY") {
            var captionData = await modifyCaptions(captionData, captionIndex, wordIndex, words);
        } else if (type == "SPLITE") {
            var captionData = await spliteCaptions(captionData, captionIndex, wordIndex);
        } else if (type == "MERGE") {
            var captionData = await mergeCaptions(captionData, captionIndex, wordIndex);
        } else {
            throw new Error('Action Type is not correct');
        }
        
        await saveCaptions(videoId, captionData);

		const response = {
            statusCode: 200,
            headers: responseHeaders
        };
        callback(null, response);
    }
    catch (error)
    {
        console.log('[ERROR] failed to put captions', error);
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({ "message": "Failed to put captions: " + error })
        };
        callback(null, response);
    }
};

async function modifyCaptions(captionData, captionIndex, wordIndex, words)
{
    var videoLanguage = process.env.TRANSCRIBE_LANGUAGE;
    captionData[captionIndex].words[wordIndex].w = words;
    captionData[captionIndex].words[wordIndex].c = 1;
    var caption = "";
    for (var i = 0; i < captionData[captionIndex].words.length; i++)
    {
        caption += captionData[captionIndex].words[i].w;

        if (videoLanguage != 'zh-CN' && i < (captionData[captionIndex].words.length - 1)) {
            caption += " ";
        }
    }
    captionData[captionIndex].caption = caption;
    
    return captionData;
}

async function spliteCaptions(captionData, captionIndex, wordIndex)
{
    console.log("captionIndex is " + captionIndex + " and wordIndex is " + wordIndex);
    var videoLanguage = process.env.TRANSCRIBE_LANGUAGE;
    var captionPart = {
        start: 0,
        caption: "",
        wordConfidence: [],
        words: []
    };
    var captionValue1 = "";
    var captionValue2 = "";

    for (var i=captionData.length; i > captionIndex; i--) {
        captionData[i] = captionData[i-1];
    }

    console.log("words length is " + captionData[captionIndex].words.length);
    console.log("wordIndex + 1 = " + (wordIndex+1));

    for (var i=wordIndex+1; i < captionData[captionIndex].words.length; i++) {
        console.log("current i is " + i);
        if (i == wordIndex+1) {
            console.log("first words:");
            console.dir(captionData[captionIndex].words[i]);
            if ("st" in captionData[captionIndex].words[i]) {
                captionPart.start = Number(captionData[captionIndex].words[i].st);
            } else {
                captionPart.start = Number(captionData[captionIndex].words[i+1].st);
            }
        }
        if (i == (captionData[captionIndex].words.length - 1)) {
            captionPart.end = Number(captionData[captionIndex].words[i].et);
        }
        captionPart.words[i-wordIndex-1] = captionData[captionIndex].words[i];
        captionValue2 += captionData[captionIndex].words[i].w;

        if (videoLanguage != 'zh-CN' && i < (captionData[captionIndex].words.length - 1)) {
            captionValue2 += " ";
        }

    }
    captionData[captionIndex].words.splice(wordIndex+1);
    captionPart.caption = captionValue2;
    console.log("captionPart:");
    console.dir(captionPart);

    console.log("captionLeft with index " + captionIndex + ":");
    console.dir(captionData[captionIndex]);

    for (var i=0; i < captionData[captionIndex].words.length; i++) {
        captionValue1 += captionData[captionIndex].words[i].w;

        if (videoLanguage != 'zh-CN' && i < (captionData[captionIndex].words.length - 1)) {
            captionValue1 += " ";
        }
    }

    captionData[captionIndex].caption = captionValue1;
    if ("et" in captionData[captionIndex].words[wordIndex]) {
        captionData[captionIndex].end = Number(captionData[captionIndex].words[wordIndex].et);
    } else {
        captionData[captionIndex].end = Number(captionData[captionIndex].words[wordIndex-1].et);
    }

    captionData[captionIndex+1] = captionPart;    
    return captionData;
}

async function mergeCaptions(captionData, checkedCaptions)
{
    var videoLanguage = process.env.TRANSCRIBE_LANGUAGE;
    var part1Index = parseInt(checkedCaptions[0]);
    var part2Index = parseInt(checkedCaptions[1]);

    if (checkedCaptions.length > 2 || (part2Index - part1Index) > 1) {
        console.log("Please check two captions to merge");
        throw new Error('Please check two captions to merge');
    }
    console.log(checkedCaptions);

    for (var i=0; i < captionData[part2Index].words.length; i++) {
        captionData[part1Index].words.push(captionData[part2Index].words[i]);
        if (videoLanguage != 'zh-CN') {
            captionData[part1Index].caption += " ";
        }
        captionData[part1Index].caption += captionData[part2Index].words[i].w;
    }
    captionData[part1Index].end = captionData[part2Index].end;

    for (var i=part2Index; i < captionData.length - 1; i++) {
        captionData[i] = captionData[i+1];
    }   
    return captionData;
}

async function saveCaptions(videoId, captionData)
{
    const transcribeBucket = process.env.TRANSCRIBE_BUCKET;
    var captionS3Parmas = {
        Bucket : transcribeBucket,
        Key : 'captions/' + videoId,
        ContentType: 'text/plain',
        Body : JSON.stringify(captionData)
    }

    console.log("[INFO] Store captions into s3 %j", captionS3Parmas);
    await s3.putObject(captionS3Parmas, function(err, data) {
         if (err) console.log(err, err.stack);
         else     console.log(data);
    }).promise();     

}