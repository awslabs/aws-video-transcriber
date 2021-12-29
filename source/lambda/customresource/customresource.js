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

/**
 * CloudFormation custom resource which performs the following actions:
 *
 * CREATE:
 *  Copies S3 files defined in the web manifest into the output bucket
 *  Creates site_config.json in the public web bucket to describe the deployed API
 *
 * UPDATE:
 *  Copies S3 files defined in the web manifest into the output bucket
 *  Overwrites the site_config.json in the public web bucket to describe the deployed API
 *
 * DELETE:
 *  Removes all web files from S3 public bucket
 */

var AWS = require("aws-sdk");
var s3 = new AWS.S3();
var apiGateway = new AWS.APIGateway();
var axios = require("axios");
var cloudwatchlogs = new AWS.CloudWatchLogs();

exports.handler = async function (event, context) {
  console.log("Handling request: %j", event);

  /**
   * Use the service token (in this case the Lambda ARN) as the resource id
   * to prevent updates triggering an additional delete if the echoed resource
   * id (in examples, usually the cloudwatch log stream) changes.
   */
  var resourceId = event.ResourceProperties.ServiceToken;

  var deployRegion = event.ResourceProperties.Region;

  try {
    if (event.RequestType == "Delete") {
      await handleDelete(event);
      await deleteLogGroup(event);
    } else if (event.RequestType == "Update") {
      await createAPIKey(event);
      await handleCreateUpdate(event);
    } else if (event.RequestType == "Create") {
      await createAPIKey(event);
      await handleCreateUpdate(event);
    } else {
      throw new Error("Unhandled request type: " + event.RequestType);
    }

    await sendResponse(event, context, "SUCCESS", null, resourceId);
  } catch (error) {
    console.log(
      "[ERROR] failed to process custom resource sending failure",
      error
    );
    await sendResponse(event, context, "FAILED", error, resourceId);
  }
};

/**
 * Handles delete events
 */
async function handleDelete(event) {
  try {
    await deleteApiKey(event);

    var webDeployTarget = event.ResourceProperties.WebDeployTarget;
    await deleteBucketObjects(webDeployTarget.Bucket);

    var videoBucket = event.ResourceProperties.VideoBucket;
    await deleteBucketObjects(videoBucket.Bucket);

    var audioBucket = event.ResourceProperties.AudioBucket;
    await deleteBucketObjects(audioBucket.Bucket);

    var transcribBucket = event.ResourceProperties.TranscribBucket;
    await deleteBucketObjects(transcribBucket.Bucket);
  } catch (error) {
    console.log("[ERROR] failed to delete custom resources", error);
  }
}

/**
 * Creates the web config file and publishes it to
 * the S3 public bucket
 */
async function createWebConfig(event) {
  try {
    var webConfig = {
      version: "1.1",
      api_base: event.ResourceProperties.APIGateway.Url,
      language: process.env.TRANSCRIBE_LANGUAGE,
      api_videos: "/videos",
      api_vocabulary: "/vocabulary",
      api_tweaks: "/tweaks",
      api_video: "/video",
      api_videostatus: "/videostatus",
      api_videoname: "/videoname",
      api_videodescription: "/videodescription",
      api_burned_video: "/burnedvideo",
      api_captions: "/caption",
      api_language: "/language",
      api_translate: "/translate",
      api_upload: "/upload",
      api_burn: "/burn",
    };

    var webDeployTarget = event.ResourceProperties.WebDeployTarget;

    var putObjectRequest = {
      Body: JSON.stringify(webConfig),
      Bucket: webDeployTarget.Bucket,
      // ACL: 'public-read',
      Key: "site_config.json",
      ContentType: "application/json",
    };
    console.log("createWebConfig start, request %j", putObjectRequest);

    await s3.putObject(putObjectRequest).promise();
  } catch (error) {
    console.log("[ERROR] failed to create web config", error);
    throw error;
  }
}

function sleep(sleepTimeMillis) {
  return new Promise((resolve) => setTimeout(resolve, sleepTimeMillis));
}

/**
 * Waits for the API Gateway Stage to be fully deployed
 */
async function waitForStage(event, sleepTimeMillis, maxSleeps) {
  var api = event.ResourceProperties.APIGateway;
  var apiId = api.Id;
  var apiStage = api.Stage;

  for (var i = 0; i < maxSleeps; i++) {
    try {
      var request = {
        restApiId: apiId,
        stageName: apiStage,
      };

      var result = await apiGateway.getStage(request).promise();
      console.log("[INFO] found API stage: %j", result);
      return;
    } catch (error) {
      console.log("[INFO] API Gateway stage is not ready, sleeping: ", error);
      await sleep(sleepTimeMillis);
    }
  }

  throw new Error("Maximum sleeps reached waiting for API stage to deploy");
}

async function deleteBucketObjects(bucket) {
  var params = {
    Bucket: bucket,
  };
  var objectList = [];
  await s3
    .listObjectsV2(params, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
      } else {
        objectList = data.Contents;
      }
    })
    .promise();

  for (var i = 0; i < objectList.length; i++) {
    await deleteS3File(bucket, objectList[i].Key);
  }
}

async function deleteS3File(bucket, key) {
  try {
    var deleteRequest = {
      Bucket: bucket,
      Key: key,
    };

    await s3.deleteObject(deleteRequest).promise();
  } catch (error) {
    console.log("[ERROR] failed to delete: s3://%s/%s", bucket, key, error);
  }
}

async function deleteLogGroup(event) {
  try {
    var params = {
      logGroupName: event.ResourceProperties.LogGroup.Name,
    };

    console.log(
      "[INFO] forceably removing log group using request: " +
        JSON.stringify(params, null, "  ")
    );

    await cloudwatchlogs.deleteLogGroup(params).promise();

    console.log("[INFO] successfully deleted log group");
  } catch (error) {
    console.log("Failed to delete log group", error);
  }
}

/**
 * Removes previously deployed API key
 */
async function deleteApiKey(event) {
  console.log("[INFO] deleteApiKey start");
  try {
    var api = event.ResourceProperties.APIGateway;

    var apiId = api.Id;
    var apiStage = api.Stage;
    var planName = api.PlanName;
    var keyName = api.Key.Name;
    var keyValue = api.Key.Value;
    var keyId = null;
    var usagePlanIds = [];

    var getApiKeysRequest = {
      nameQuery: keyName,
    };

    var getApiKeysResponse = await apiGateway
      .getApiKeys(getApiKeysRequest)
      .promise();

    console.log("[INFO] got getApiKeys() response: %j", getApiKeysResponse);

    if (getApiKeysResponse.items && getApiKeysResponse.items.length == 1) {
      keyId = getApiKeysResponse.items[0].id;

      var getUsagePlansRequest = {
        keyId: keyId,
      };

      var getUsagePlansResponse = await apiGateway
        .getUsagePlans(getUsagePlansRequest)
        .promise();

      console.log(
        "[INFO] got getUsagePlans() response: %j",
        getUsagePlansResponse
      );

      if (getUsagePlansResponse.items) {
        for (var i = 0; i < getUsagePlansResponse.items.length; ++i) {
          usagePlanIds.push(getUsagePlansResponse.items[i].id);
        }
      }
    }

    console.log("[INFO] found key to delete: %s", keyId);
    console.log("[INFO] found usage plans to delete: %j", usagePlanIds);

    for (var i = 0; i < usagePlanIds.length; i++) {
      var deleteUsagePlanKeyRequest = {
        keyId: keyId,
        usagePlanId: usagePlanIds[i],
      };

      await apiGateway.deleteUsagePlanKey(deleteUsagePlanKeyRequest).promise();

      console.log("[INFO] successfully deleted usage plan key");

      var updateUsagePlanRequest = {
        usagePlanId: usagePlanIds[i],
        patchOperations: [
          {
            from: "STRING_VALUE",
            op: "remove",
            path: "/apiStages",
            value: apiId + ":" + apiStage,
          },
        ],
      };

      await apiGateway.updateUsagePlan(updateUsagePlanRequest).promise();

      console.log("[INFO] removed stage from usage plan");

      var deleteUsagePlanRequest = {
        usagePlanId: usagePlanIds[i],
      };

      await apiGateway.deleteUsagePlan(deleteUsagePlanRequest).promise();

      console.log("[INFO] successfully deleted usage plan: " + usagePlanIds[i]);
    }

    if (keyId) {
      var deleteApiKeyRequest = {
        apiKey: keyId,
      };

      await apiGateway.deleteApiKey(deleteApiKeyRequest).promise();

      console.log("[INFO] successfully deleted API key: " + keyId);
    }
  } catch (error) {
    console.log("[ERROR] failed to delete API key material", error);
  }
}

/**
 * Creates a custom API Gateway key and assocaites it with the
 * deployed stage
 */
async function createAPIKey(event) {
  try {
    await waitForStage(event, 10000, 50);

    console.log("[INFO] Stage is ready, creating API key");

    var api = event.ResourceProperties.APIGateway;

    var apiId = api.Id;
    var apiStage = api.Stage;
    var planName = api.PlanName;
    var keyName = api.Key.Name;
    var keyValue = api.Key.Value;

    var createKeyParams = {
      description: "AWS Captions API Key",
      enabled: true,
      name: keyName,
      value: keyValue,
    };

    console.log(
      "[INFO] about to create api key: " +
        JSON.stringify(createKeyParams, null, "  ")
    );

    var createApiKeyResponse = await apiGateway
      .createApiKey(createKeyParams)
      .promise();

    console.log("[INFO] got createApiKey() response: %j", createApiKeyResponse);

    var createUsagePlanParams = {
      name: planName,
      apiStages: [
        {
          apiId: apiId,
          stage: apiStage,
        },
      ],
      description: "AWS Captions API Usage Plan",
    };

    console.log(
      "[INFO] about to create usage plan: " +
        JSON.stringify(createUsagePlanParams, null, "  ")
    );

    var createUsagePlanResponse = await apiGateway
      .createUsagePlan(createUsagePlanParams)
      .promise();

    console.log(
      "[INFO] got createUsagePlan() response: %j",
      createUsagePlanResponse
    );

    var createUsagePlanKeyParams = {
      keyId: createApiKeyResponse.id,
      keyType: "API_KEY",
      usagePlanId: createUsagePlanResponse.id,
    };

    console.log(
      "[INFO] about to create usage plan key: " +
        JSON.stringify(createUsagePlanKeyParams, null, "  ")
    );

    var createUsagePlanKeyResponse = await apiGateway
      .createUsagePlanKey(createUsagePlanKeyParams)
      .promise();

    console.log(
      "[INFO] got createUsagePlanKey() response: %j",
      createUsagePlanKeyResponse
    );

    console.log("[INFO] successfully created API key");
  } catch (error) {
    console.log("[ERROR] failed to create API key material", error);
  }
}

/**
 * Handles create and update events
 */
async function handleCreateUpdate(event) {
  try {
    console.log("handleCreateUpdate start");
    await createWebConfig(event);

    var inputManifest = event.ResourceProperties.InputManifest;
    var webDeploySource = event.ResourceProperties.WebDeploySource;
    var webDeployTarget = event.ResourceProperties.WebDeployTarget;

    var manifest = await loadManifest(inputManifest.Bucket, inputManifest.Key);

    var count = 0;

    for (var i = 0; i < manifest.files.length; i++) {
      var file = manifest.files[i];

      await copyS3File(
        webDeploySource.Bucket,
        webDeploySource.ContentPrefix + "/" + manifest.sourcePrefix + file,
        webDeployTarget.Bucket,
        manifest.targetPrefix + file
      );

      count++;
    }
  } catch (error) {
    console.log("[ERROR] failed to create or update custom resources", error);
    throw error;
  }
}

/**
 * Loads a file containing a manifest of files to copy
 */
async function loadManifest(manifestBucket, manifestKey) {
  try {
    var getParams = {
      Bucket: manifestBucket,
      Key: manifestKey,
    };

    console.log("[INFO] loading manifest using: %j", getParams);

    var getObjectResponse = await s3.getObject(getParams).promise();

    var body = getObjectResponse.Body.toString();

    console.log("[INFO] got body: %s", body);

    return JSON.parse(body).manifest;
  } catch (error) {
    console.log("[ERROR] failed to load manifest", error);
    throw error;
  }
}

async function copyS3File(
  sourceBucket,
  sourceKey,
  destinationBucket,
  destinationKey
) {
  try {
    var copyRequest = {
      Bucket: destinationBucket,
      Key: destinationKey,
      // ACL: 'public-read',
      CopySource: encodeURIComponent("/" + sourceBucket + "/" + sourceKey),
    };

    await s3.copyObject(copyRequest).promise();
  } catch (error) {
    console.log(
      "[ERROR] failed to copy: s3://%s/%s to s3://%s/%s",
      sourceBucket,
      sourceKey,
      destinationBucket,
      destinationKey,
      error
    );
    throw error;
  }
}

async function deleteS3File(bucket, key) {
  try {
    var deleteRequest = {
      Bucket: bucket,
      Key: key,
    };

    await s3.deleteObject(deleteRequest).promise();
  } catch (error) {
    console.log("[ERROR] failed to delete: s3://%s/%s", bucket, key, error);
  }
}

/**
 * Sends the response to the provided pre-signed url
 */
async function sendResponse(
  event,
  context,
  responseStatus,
  failureReason,
  physicalResourceId
) {
  var reason =
    responseStatus == "FAILED" ? "Failure reason: " + failureReason : undefined;

  var responseBody = JSON.stringify({
    StackId: event.StackId,
    RequestId: event.RequestId,
    Status: responseStatus,
    Reason: reason,
    PhysicalResourceId: physicalResourceId || context.logStreamName,
    LogicalResourceId: event.LogicalResourceId,
    Data: {},
  });

  var responseOptions = {
    headers: {
      "Content-Type": "",
      "Content-Length": responseBody.length,
    },
  };

  console.info("Response body:\n", responseBody);

  try {
    await axios.put(event.ResponseURL, responseBody, responseOptions);

    console.info("CloudFormationSendResponse Success");
  } catch (error) {
    console.error("CloudFormationSendResponse Error:");

    if (error.response) {
      console.error(error.response.data);
      console.error(error.response.status);
      console.error(error.response.headers);
    } else if (error.request) {
      console.error(error.request);
    } else {
      console.error("Error", error.message);
    }

    console.error(error.config);

    throw new Error("Could not send CloudFormation response");
  }
}
