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
var transcribe;
if (process.env.REGION === 'cn-northwest-1' || process.env.REGION === "cn-north-1")
{
	transcribe = new AWS.TranscribeService({endpoint: 'https://cn.transcribe.' + process.env.REGION + '.amazonaws.com.cn'});
}
else
{
	transcribe = new AWS.TranscribeService();
}
var dynamoDB = new AWS.DynamoDB();

/**
 * Invokes Amazon Transcribe to extract a 
 * JSON transcript of an audio file.
 */
exports.handler = async (event, context, callback) => {

	console.log("[INFO] processing event: %j", event);
    
	try
	{
		var params = await computeParameters(event);
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
async function computeParameters(event)
{
	var inputKey =
        decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));    

	var audioFile = path.basename(inputKey);
	var videoId = audioFile.substring(audioFile.lastIndexOf("_") + 1, audioFile.length - 4);
	console.log("[INFO] videoId: " + videoId);
	var inputBucket = event.Records[0].s3.bucket.name;
	var mediaFileUrl = "https://s3-" + process.env.REGION + ".amazonaws.com/" + inputBucket + "/" + inputKey;

	var params = 
	{
		inputKey: inputKey,
		audioFile: audioFile,
		videoId: videoId,
		inputBucket: inputBucket,
		outputBucket: process.env.TRANSCRIBE_BUCKET,
		mediaFileUrl: mediaFileUrl,
		region: process.env.REGION,
		transcribeLanguage: process.env.TRANSCRIBE_LANGUAGE,
		vocabularyName: process.env.VOCABULARY_NAME,
		vocabularyExists: false,
		dynamoVideoTable: process.env.DYNAMO_VIDEO_TABLE,
		status: "PROCESSING",
		statusText: "Transcribing audio"
	};

	var vocabularies = await getVocabularies(null);

	if (vocabularies.length > 0)
	{
		params.vocabularyExists = true;
	}        

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
			Media: 
			{
    			MediaFileUri: params.mediaFileUrl
  			},
  			MediaFormat: "mp4",
  			TranscriptionJobName: params.videoId,
  			OutputBucketName: params.outputBucket
		};

		transcribeParams.LanguageCode = params.transcribeLanguage;

		if (params.vocabularyExists)
		{
			console.log('[INFO] found existing vocabulary enabling');
			transcribeParams.Settings = {
				VocabularyName: params.vocabularyName
			};
		}
		else
		{
			console.log('[INFO] no existing vocabulary found, skipping vocabulary use');
		}

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

/**
 * Fetch vocabularies recursively filtering by vocabulary name
 */
async function getVocabularies(nextToken)
{
    try
    {
        var vocabularies = [];

        var vocabularyName = process.env.VOCABULARY_NAME;

        var listVocabularyParams = {
            NameContains: vocabularyName
        };

        if (nextToken)
        {
            listVocabularyParams.NextToken = nextToken;
        }

        console.log('[INFO] listing vocabularies using params: %j', listVocabularyParams);

        var listVocabularyResponse = await transcribe.listVocabularies(listVocabularyParams).promise();

        console.log('[INFO] got list vocabulary response: %j', listVocabularyResponse);

        if (listVocabularyResponse.Vocabularies)
        {
            vocabularies = vocabularies.concat(listVocabularyResponse.Vocabularies);
        }

        if (listVocabularyResponse.NextToken)
        {
            vocabularies = vocabularies.concat(await getVocabularies(listVocabularyResponse.NextToken));
        }

        return vocabularies;
    }
    catch (error)
    {
        console.log('[ERROR] failed to list vocabularies' + error);
        throw error;
    }
}
