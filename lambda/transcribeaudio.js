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
var transcribe = new AWS.TranscribeService();
var dynamoDB = new AWS.DynamoDB();

/**
 * Invokes Amazon Transcribe to extract a 
 * JSON transcript of an audio file.
 */
exports.handler = async (event, context, callback) => {

	console.log("[INFO] processing event: %j", event);
    
	try
	{
		var params = computeParameters(event);
		await transcribeAudio(params);
		await updateDynamoDB(params);
		callback(null, "Successfully launched Transcribe job");
	}
	catch (error)
	{
        console.log("[ERROR] failed to launch Transcribe job", error);
        params.status = "ERRORED";
        params.statusText = "Failed to launch Transcribe job: " + error.message;
        await updateDynamoDB(params);
        callback(error);
	}
};

/**
 * Computes parameters
 */
function computeParameters(event)
{
	var inputKey =
        decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));    

	var audioFile = path.basename(inputKey);
	var videoId = audioFile.substring(0, audioFile.length - 4);
	var inputBucket = event.Records[0].s3.bucket.name;
	var mediaFileUrl = "https://s3-" + process.env.REGION + ".amazonaws.com/" + inputBucket + "/" + inputKey;

	var params = 
	{
		inputKey: inputKey,
		audioFile: audioFile,
		videoId: videoId,
		inputBucket: inputBucket,
		outputBucket: process.env.OUTPUT_BUCKET,
		mediaFileUrl: mediaFileUrl,
		region: process.env.REGION,
		transcribeLanguage: process.env.TRANSCRIBE_LANGUAGE,
		vocabularyName: process.env.VOCABULARY_NAME,
		dynamoVideoTable: process.env.DYNAMO_VIDEO_TABLE,
		status: "PROCESSING",
		statusText: "Transcribing audio"
	};

	console.log("[INFO] computed initial parameters: %j", params);

	return params;
}

/**
 * Removes an existing Transcribe job if it exists
 */
async function removeTranscribeJob(params)
{
	try
	{
		var deleteParams = 
		{
			TranscriptionJobName: params.videoId
		};

		await transcribe.deleteTranscriptionJob(deleteParams).promise();
		params.jobDeleted = true;
		console.log("[INFO] deleted Transcribe job: " + params.videoId);
	}
	catch (error)
	{
		params.jobDeleted = false;
		console.log("[WARNING] failed to remove existing Transcribe job, perhaps it did not exist", error);
	}
}

/**
 * Runs a job through transcribe removing previous jobs for
 * this video
 */
async function transcribeAudio(params)
{
	try
	{
		/**
		 * First try and purge the previous transcribe job
		 * Transcribe uses the job id as the output result file
		 * name in S3 which is our link to videoId so we must remove
		 * prior runs
		 */
		await removeTranscribeJob(params);

		var transcribeParams = {
		  	LanguageCode: params.transcribeLanguage,
			Media: 
			{
    			MediaFileUri: params.mediaFileUrl
  			},
  			MediaFormat: "mp3",
  			MediaSampleRateHertz: 44100,
  			TranscriptionJobName: params.videoId,
  			OutputBucketName: params.outputBucket,
 			Settings: 
 			{
			    VocabularyName: params.vocabularyName
  			}
		};

		console.log("[INFO] about to launch Transcribe job with params: %j", 
			transcribeParams);

		var transcribeResult = await transcribe.startTranscriptionJob(transcribeParams).promise();

		console.log("[INFO] got startTranscriptionJob() response: %j", 
			transcribeResult);
	}
	catch (error)
	{
		console.log("[ERROR] failed to transcribe audio", error);
		throw error;
	}
}

/**
 * Update Dynamo status for a video
 */
async function updateDynamoDB(params)
{
	try
	{
		var updateParams = 
		{
			TableName: params.dynamoVideoTable,
			Key: 
            {
                "videoId" : { "S": params.videoId }
            },
            UpdateExpression: "SET #status = :status, #statusText = :statusText",
            ExpressionAttributeNames: {
   				"#status": "status",
   				"#statusText": "statusText",
  			},
			ExpressionAttributeValues: {
   				":status": {
     				S: params.status
    			},
    			":statusText": {
     				S: params.statusText
    			}
			},
			ReturnValues: "NONE" 			
		};

		await dynamoDB.updateItem(updateParams).promise();

		console.log("[INFO] successfully updated DynamoDB status");
	}
	catch (error)
	{
		console.log("[ERROR] to update DynamoDB status", error);
        throw error;
	}
}
