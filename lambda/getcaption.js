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
var dynamoDB = new AWS.DynamoDB();
var s3 = new AWS.S3();

/**
 * Fetches captions in WEBVTT or SRT formats
 */
exports.handler = async (event, context, callback) => {

    console.log('[INFO] got event: %j', event);

    try
    {
        var format = "webvtt";
        var contentType = 'text/vtt';

        if (event.queryStringParameters && event.queryStringParameters.format)
        {
            format = event.queryStringParameters.format;
        }

        if (format === 'srt')
        {
            contentType = 'text/srt';
        }

        console.log('[INFO] exporting in: %s format', format);

        var videoId = event.pathParameters.videoId;

        var getParams = {
            TableName: process.env.DYNAMO_CAPTION_TABLE,
            Key: 
            {
                'videoId' : { 'S': videoId },
            },
        };

        console.log("[INFO] calling getItem with parameters: %j", getParams);
        var getResponse = await dynamoDB.getItem(getParams).promise();
        console.log("[INFO] getItem response from Dynamo: %j", getResponse);


        if (getResponse.Item)
        {
            var captions = JSON.parse(getResponse.Item.captions.S);

            var result = await exportCaptions(format, captions);

            var responseHeaders = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
                'Content-Type': contentType
            };
            const response = {
                statusCode: 200,
                headers: responseHeaders,
                body: result
            };
            console.log('[INFO] response: %j', response);

            callback(null, response);
        }
        else
        {
            throw new Error('Captions not found');
        }
    }
    catch (error)
    {
        console.log("[ERROR] Failed to load captions", error);

        var responseHeaders = {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': true,
            'Content-Type': 'application/json'
        };
        const response = {
            statusCode: 500,
            headers: responseHeaders,
            body: JSON.stringify({  "message": "Failed to load captions: " + error })
        };
        callback(null, response);
    }
};

async function exportCaptions(format, captions)
{
    if (format === 'webvtt')
    {
        var webvtt = 'WEBVTT\n\n';

        for (var i in captions)
        {
            var caption = captions[i];

            webvtt += formatTimeWEBVTT(caption.start) + ' --> ' + formatTimeWEBVTT(caption.end) + '\n';
            webvtt += caption.caption + '\n\n';
        }

        return webvtt;
    }
    else if (format === 'srt') 
    {
        var srt = '';

        var index = 1;

        for (var i in captions)
        {
            var caption = captions[i];
            srt += index + '\n';
            srt += formatTimeSRT(caption.start) + ' --> ' + formatTimeSRT(caption.end) + '\n';
            srt += caption.caption + '\n\n';
            index++;
        }

        return srt;
    }
    else
    {
        throw new Error("Invalid format requested: " + format);
    }
}

/**
 * Format a VTT timestamp in HH:MM:SS.mmm
 */
function formatTimeWEBVTT(timeSeconds)
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
            (seconds + '').padStart(2, '0') + '.' +
            (Math.floor(millis * 1000) + '').padStart(3, '0');
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
