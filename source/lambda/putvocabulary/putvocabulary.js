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

var AWS = require("aws-sdk");
AWS.config.update({ region: process.env.REGION });
var dynamoDB = new AWS.DynamoDB({ apiVersion: "2012-10-08" });
var transcribe;
if (
  process.env.REGION === "cn-northwest-1" ||
  process.env.REGION === "cn-north-1"
) {
  transcribe = new AWS.TranscribeService({
    endpoint:
      "https://cn.transcribe." + process.env.REGION + ".amazonaws.com.cn",
  });
} else {
  transcribe = new AWS.TranscribeService();
}
/**
 * Saves vocabulary to the Dynamo table pointed to by the
 * the environment variable: CONFIG_VIDEO_TABLE
 */
exports.handler = async (event, context, callback) => {
  console.log("Event: %j", event);

  var responseHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json",
  };

  try {
    var vocabularyName = process.env.VOCABULARY_NAME;
    var transcribeLanguage = process.env.TRANSCRIBE_LANGUAGE;

    /**
     * The vocabulary submitted by the user
     */
    var vocabulary = JSON.parse(event.body);

    /**
     * Check to see if the vocabulary exists
     */
    var vocabularies = await getVocabularies(null);

    if (vocabularies.length > 0) {
      console.log("[INFO] existing vocabulary found: %j", vocabularies[0]);

      /**
       * Update the vocabulary
       */
      var updateVocabularyParams = {
        LanguageCode: transcribeLanguage,
        VocabularyName: vocabularyName,
        Phrases: vocabulary.vocabulary,
      };

      var updateVocabularyResponse = await transcribe
        .updateVocabulary(updateVocabularyParams)
        .promise();

      console.log(
        "[INFO] got update vocabulary response: %j",
        updateVocabularyResponse
      );
    } else {
      console.log("[INFO] no existing vocabulary found, creating one");

      /**
       * Create a new vocabulary
       */
      var createVocabularyParams = {
        LanguageCode: transcribeLanguage,
        VocabularyName: vocabularyName,
        Phrases: vocabulary.vocabulary,
      };

      var createVocabularyResponse = await transcribe
        .createVocabulary(createVocabularyParams)
        .promise();

      console.log(
        "[INFO] got create vocab response: %j",
        createVocabularyResponse
      );
    }

    /**
     * Now update Dynamo with the vocabulary
     */
    var putParams = {
      TableName: process.env.DYNAMO_CONFIG_TABLE,
      Item: {
        configId: { S: "vocabulary" },
        configValue: { S: JSON.stringify(vocabulary) },
      },
    };

    /**
     * Save vocabulary to DynamoDB
     */
    var putResponse = await dynamoDB.putItem(putParams).promise();

    console.log("[INFO] got Dynamo PUT response: %j", putResponse);

    vocabulary.canUpdate = false;

    const response = {
      statusCode: 200,
      headers: responseHeaders,
      body: JSON.stringify(vocabulary),
    };

    callback(null, response);
  } catch (error) {
    console.log("Failed to update vocabulary", error);

    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to update vocabulary: " + error,
      }),
    };

    callback(null, response);
  }
};

/**
 * Fetch vocabularies recursively filtering by vocabulary name
 */
async function getVocabularies(nextToken) {
  try {
    var vocabularies = [];

    var vocabularyName = process.env.VOCABULARY_NAME;

    var listVocabularyParams = {
      NameContains: vocabularyName,
    };

    if (nextToken) {
      listVocabularyParams.NextToken = nextToken;
    }

    console.log(
      "[INFO] listing vocabularies using params: %j",
      listVocabularyParams
    );

    var listVocabularyResponse = await transcribe
      .listVocabularies(listVocabularyParams)
      .promise();

    console.log(
      "[INFO] got list vocabulary response: %j",
      listVocabularyResponse
    );

    if (listVocabularyResponse.Vocabularies) {
      vocabularies = vocabularies.concat(listVocabularyResponse.Vocabularies);
    }

    if (listVocabularyResponse.NextToken) {
      vocabularies = vocabularies.concat(
        await getVocabularies(listVocabularyResponse.NextToken)
      );
    }

    return vocabularies;
  } catch (error) {
    console.log("[ERROR] failed to list vocabularies");
    throw error;
  }
}
