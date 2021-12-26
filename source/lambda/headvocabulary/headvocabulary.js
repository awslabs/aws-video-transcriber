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
 * Checks if vocabulary can currently be updated
 */
exports.handler = async (event, context, callback) => {
  console.log("[INFO] Event: %j", event);

  try {
    var canUpdate = true;

    /**
     * Load vocabularies handling pagination
     */
    var vocabularies = await getVocabularies(null);

    console.log("[INFO] found vocabularies: %j", vocabularies);

    if (vocabularies.length > 0) {
      var status = vocabularies[0].VocabularyState;

      console.log("[INFO] found vocabulary status: " + status);

      if (status == "PENDING") {
        console.log("[INFO] vocabulary cannot be updated now");
        canUpdate = false;
      } else {
        console.log("[INFO] vocabulary can be updated now");
        canUpdate = true;
      }
    } else {
      console.log(
        "[INFO] no existing vocabulary, vocabulary can be updated now"
      );
      canUpdate = true;
    }

    var responseHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    };

    const response = {
      statusCode: canUpdate ? 200 : 204,
      headers: responseHeaders,
    };

    callback(null, response);
  } catch (error) {
    console.log("Failed to check vocaulary ready status", error);
    const response = {
      statusCode: 500,
      headers: responseHeaders,
      body: JSON.stringify({
        message: "Failed to check vocaulary ready status: " + error,
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
    console.log("[ERROR] failed to list vocabularies", error);
    throw error;
  }
}
