
var path = require("path");
var uuidv4 = require("uuid/v4");
var AWS = require("aws-sdk");
AWS.config.update({region: process.env.REGION});  
var dynamoDB = new AWS.DynamoDB();
var elasticTranscoder = new AWS.ElasticTranscoder();

/**
 * Invokes ElasticTranscoder to extract MP3 audio 
 * and perhaps converts to MP4 video and tracks status
 * in DynamoDB
 */
exports.handler = async (event, context, callback) => {

    console.log("[INFO] handling event: %j", event);

    var params = { };

    try
    {
        /**
         * Minimum parameters to check for prior processings
         */
        params.dynamoVideoTable = process.env.DYNAMO_VIDEO_TABLE;
        params.inputBucket = process.env.INPUT_BUCKET;
        params.inputKey = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, " "));
        params.videoName = path.basename(params.inputKey);
        params.inputS3Path = "s3://" + params.inputBucket + "/" + params.inputKey;

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
         * Optionally convert video to MP4 if required
         */
        await extractVideo(params);

        /**
         * Update the Dynamo status for successful processing steps
         */
        await updateDynamoDB(params); 

        callback(null, "Audio processing complete");
    }
    catch (error)
    {
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
function computeRemainingParams(event, params)
{
    var mp3PresetId = "1351620000001-300040"; // Audio MP3
    var mp4PresetId = "1351620000001-100070"; // Web MP4

    var outputAudioBucket = process.env.OUTPUT_AUDIO_BUCKET;
    var outputVideoBucket = process.env.OUTPUT_VIDEO_BUCKET;

    var outputAudioKeyPrefix = process.env.OUTPUT_AUDIO_KEY_PREFIX;
    var outputVideoKeyPrefix = process.env.OUTPUT_VIDEO_KEY_PREFIX;

    /**
     * If this is the first time through create a new videoId
     */
    if (params.videoId == null)
    {
        params.videoId = uuidv4();
    }
    
    params.audioProcessingRequired = true;
    params.videoProcessingRequired = true;
    
    params.transcoderRole = process.env.TRANSCODER_ROLE;
    
    params.mp3PresetId = mp3PresetId;
    params.audioPipelineName = process.env.TRANSCODER_AUDIO_PIPELINE_NAME;
    params.outputAudioBucket = outputAudioBucket;
    params.outputAudioKeyPrefix = outputAudioKeyPrefix;
    params.outputAudioKey = outputAudioKeyPrefix + "/" + params.videoId + ".mp3";
    params.outputAudioS3Path = "s3://" + outputAudioBucket + "/" + outputAudioKeyPrefix + "/" + params.videoId + ".mp3";

    params.mp4PresetId = mp4PresetId;
    params.videoPipelineName = process.env.TRANSCODER_VIDEO_PIPELINE_NAME;
    params.outputVideoBucket = outputVideoBucket;
    params.outputVideoKeyPrefix = outputVideoKeyPrefix;
    params.outputVideoKey = outputVideoKeyPrefix + "/" + params.videoId + ".mp4";
    params.outputVideoS3Path = "s3://" + outputVideoBucket + "/" + outputVideoKeyPrefix + "/" + params.videoId + ".mp4";

    params.dynamoVideoTable = process.env.DYNAMO_VIDEO_TABLE;

    params.status = "PROCESSING";       
    params.statusText = "Extracting audio";
    
    /**
     * Check format and only accept MP4, MKV and MOV files
     */
    if (params.inputKey.toLowerCase().endsWith(".mp4"))
    {
        console.log("[INFO] found compatible MP4 input video file: %s", params.inputKey);
        params.videoType = "MP4"; 
        params.videoProcessingRequired = false;       
        params.outputVideoKey = params.inputKey;
        params.outputVideoS3Path = params.inputS3Path;
    }
    else if (params.inputKey.toLowerCase().endsWith(".mkv"))
    {
        console.log("[INFO] found MKV input video file that requires transcoding: %s", params.inputKey);
        params.videoType = "MKV";
    }
    else if (params.inputKey.toLowerCase().endsWith(".mov"))
    {
        console.log("[INFO] found MOV input video file that requires transcoding: %s", params.inputKey);
        params.videoType = "MOV";
    }
    else
    {
        console.log("[ERROR] found incompatible input video file, skipping: %s", params.inputKey);
        params.videoType = "UNKNOWN";
    }

    console.log("[INFO] computed initial parameters: %j", params);
}

/**
 * Checks for prior processing by inspecting the DynamoDB
 * videos table
 */
async function checkForPriorProcessing(params)
{
    try
    {
        var queryParams = {
            TableName: params.dynamoVideoTable,
            IndexName: "s3VideoPathIndex",
            KeyConditionExpression: "s3VideoPath = :s3_video_path",
            ExpressionAttributeValues: { ":s3_video_path" : { "S" : params.inputS3Path } } 
        };

        console.log("[INFO] checking DynamoDB for existing video using: %j", queryParams);
        var queryResponse = await dynamoDB.query(queryParams).promise();
        console.log("[INFO] got successful response from GSI query: %j", queryResponse);

        if (queryResponse.Items && queryResponse.Items[0])
        {
            params.videoId = queryResponse.Items[0].videoId.S;
            params.videoName = queryResponse.Items[0].name.S;
            params.videoDescription = queryResponse.Items[0].description.S;
        }
    }
    catch (error)
    {
        console.log("[ERROR] failed to check if video exists in DynamoDB", error);
        throw error;
    }
}

/**
 * Fail if the video type is UNKNOWN
 */
function checkVideoType(params)
{
    if (params.videoType === "UNKNOWN")
    {
        throw new Error("Unhandled video type detected");
    }
}

/**
 * Queues an audio extraction job in elastic transcoder
 */
async function extractAudio(params)
{
    /**
     * Fetch the Elastic Transcoder pipeline id
     */
    const pipelineId = await getAudioElasticTranscoderPipeline(params, null);

    params.pipelineId = pipelineId;

    var transcoderParams = {
        PipelineId: params.pipelineId,
        OutputKeyPrefix: params.outputAudioKeyPrefix + "/",
        Input: {
            Key: params.inputKey
        },
        Outputs: [
            {
                Key: params.videoId + ".mp3",
                PresetId: params.mp3PresetId //128 bit MP3
            }
        ]
    };

    try
    {
        console.log("[INFO] creating audio trancoder job with parameters: %j", transcoderParams);
        const createData = await elasticTranscoder.createJob(transcoderParams).promise();
        console.log("[INFO] audio elastic transcoder job created successfully");
    }
    catch (error)
    {
        console.log("[ERROR] failed create audio transcoder job", error);
        throw error;
    }
}

/**
 * Queues an video transcoder job in elastic transcoder
 */
async function extractVideo(params)
{
    if (!params.videoProcessingRequired)
    {
        return;
    }

    /**
     * Fetch the Elastic Transcoder pipeline id
     */
    const pipelineId = await getVideoElasticTranscoderPipeline(params, null);

    params.pipelineId = pipelineId;

    var transcoderParams = {
        PipelineId: params.pipelineId,
        OutputKeyPrefix: params.outputVideoKeyPrefix + "/",
        Input: {
            Key: params.inputKey
        },
        Outputs: [
            {
                Key: params.videoId + ".mp4",
                PresetId: params.mp4PresetId // Web MP4
            }
        ]
    };

    try
    {
        console.log("[INFO] creating trancoder job with parameters: %j", transcoderParams);
        const createData = await elasticTranscoder.createJob(transcoderParams).promise();
        console.log("[INFO] elastic transcoder job created successfully");
        return;
    }
    catch (error)
    {
        console.log("[ERROR] failed create transcoder job", error);
        throw error;
    }
}

/**
 * Update the DynamoDB Table with the latest status
 */
async function updateDynamoDB(params)
{
    console.log("[INFO] saving item to DynamoDB using params: %j", params);

    var putParams = {
        TableName: params.dynamoVideoTable,
        Item: 
        {
            "videoId" : {"S": params.videoId},
            "name": { "S": params.videoName},
            "s3VideoPath" : {"S": params.inputS3Path },
            "s3AudioPath" : {"S": params.outputAudioS3Path },
            "s3TranscodedVideoPath" : {"S": params.outputVideoS3Path },
            "status": {"S": params.status},
            "statusText": {"S": params.statusText},
            "processedDate":  {"S": new Date().toISOString() }
        }
    };

    // Preserve description
    if (params.videoDescription.length > 0)
    {
        putParams.Item.description = { "S": params.videoDescription };
    }

    try
    {
        console.log("[INFO] putting item into Dynamo with parameters: %j", putParams);
        const putData = await dynamoDB.putItem(putParams).promise();
        console.log("[INFO] successfully put item with response: %j", putData);
    }
    catch (error)
    {
        console.log("[ERROR] failed to put video item into DynamoDB", error);
        throw error;
    }
}

/**
 * Look for matching audio pipelines searching by name.
 * if we find a pipeline, check the input and output buckets
 * and update if they don't match.
 * If we don't find a match create a new pipeline and return it.
 */
async function getAudioElasticTranscoderPipeline(params, pageToken) 
{
    console.log("[INFO] trying to determine audio pipeline id using params: %j", params);

    var queryParams = { };

    if (pageToken)
    {
        queryParams = 
        {
            PageToken: pageToken
        };
    }

    try
    {
        var listData = await elasticTranscoder.listPipelines(queryParams).promise();

        console.log("[INFO] got successful list pipelines response: %j", listData);

        if (listData.Pipelines)
        {
            for (var i in listData.Pipelines) 
            {
                var pipeline = listData.Pipelines[i];

                if (pipeline.Name === params.audioPipelineName)
                {
                    if (pipeline.InputBucket === params.inputBucket &&
                        pipeline.OutputBucket === params.outputAudioBucket)
                    {
                        console.log("[INFO] found matching audio pipeline: " + pipeline.Id);
                        return pipeline.Id;    
                    }
                    else
                    {
                        console.log("[WARN] found audio pipeline but input and output bucket do not match");
                        
                        var updateParams = {
                            Id: pipeline.Id,
                            InputBucket: params.inputBucket,
                            Name: params.audioPipelineName,
                            Role: params.transcoderRole,
                            OutputBucket: params.outputAudioBucket
                        };

                        console.log("[INFO] updating audio transcode pipeline with parameters: %j", updateParams);
                        var updateData = await elasticTranscoder.updatePipeline(updateParams).promise();
                        console.log("[INFO] got successful audio pipeline update response: %j", updateData); 
                        return updateData.Pipeline.Id;
                    }
                }
            }
        }
        else
        {
            console.log("[INFO] no pipelines were found");
        }

        /**
         * We got to the end of the data with a next page 
         * of pipelines so go back for more results recursively
         */
        if (listData.NextPageToken)
        {
            console.log("[INFO] going back for more pipelines as we did not find a match yet");
            return await getAudioElasticTranscoderPipeline(params, listData.NextPageToken);
        }
        else
        {
            console.log("[INFO] no matched pipeline found, creating one");

            var createParams = {
                InputBucket: params.inputBucket,
                Name: params.audioPipelineName,
                Role: params.transcoderRole,
                OutputBucket: params.outputAudioBucket
            };

            console.log("[INFO] creating transcode pipeline with parameters: %j", createParams);
            var createData = await elasticTranscoder.createPipeline(createParams).promise();
            console.log("[INFO] got successful create pipeline response: %j", createData);
            return createData.Pipeline.Id;
        }
    }
    catch (error)
    {
        console.log("[ERROR] failed to fetch pipeline id", error);
        throw error;
    }
}

/**
 * Look for matching video pipelines searching by name.
 * if we find a pipeline, check the input and output buckets
 * and update if they don't match.
 * If we don't find a match create a new pipeline and return it.
 */
async function getVideoElasticTranscoderPipeline(params, pageToken) 
{
    console.log("[INFO] trying to determine video pipeline id using params: %j", params);

    var queryParams = { };

    if (pageToken)
    {
        queryParams = 
        {
            PageToken: pageToken
        };
    }

    try
    {
        var listData = await elasticTranscoder.listPipelines(queryParams).promise();

        console.log("[INFO] got successful list pipelines response: %j", listData);

        if (listData.Pipelines)
        {
            for (var i in listData.Pipelines) 
            {
                var pipeline = listData.Pipelines[i];

                if (pipeline.Name === params.videoPipelineName)
                {
                    if (pipeline.InputBucket === params.inputBucket &&
                        pipeline.OutputBucket === params.outputVideoBucket)
                    {
                        console.log("[INFO] found matching video pipeline: " + pipeline.Id);
                        return pipeline.Id;    
                    }
                    else
                    {
                        console.log("[WARN] found video pipeline but input and output bucket do not match");
                        
                        var updateParams = {
                            Id: pipeline.Id,
                            InputBucket: params.inputBucket,
                            Name: params.videoPipelineName,
                            Role: params.transcoderRole,
                            OutputBucket: params.outputVideoBucket
                        };

                        console.log("[INFO] updating video transcode pipeline with parameters: %j", updateParams);
                        var updateData = await elasticTranscoder.updatePipeline(updateParams).promise();
                        console.log("[INFO] got successful pipeline update response: %j", updateData); 
                        return updateData.Pipeline.Id;
                    }
                }
            }
        }
        else
        {
            console.log("[INFO] no pipelines were found");
        }

        /**
         * We got to the end of the data with a next page 
         * of pipelines so go back for more results recursively
         */
        if (listData.NextPageToken)
        {
            console.log("[INFO] going back for more video pipelines as we did not find a match yet");
            return await getVideoElasticTranscoderPipeline(params, listData.NextPageToken);
        }
        else
        {
            console.log("[INFO] no matched pipeline found, creating one");

            var createParams = {
                InputBucket: params.inputBucket,
                Name: params.videoPipelineName,
                Role: params.transcoderRole,
                OutputBucket: params.outputVideoBucket
            };

            console.log("[INFO] creating video transcode pipeline with parameters: %j", createParams);
            var createData = await elasticTranscoder.createPipeline(createParams).promise();
            console.log("[INFO] got successful create video pipeline response: %j", createData);
            return createData.Pipeline.Id;
        }
    }
    catch (error)
    {
        console.log("[ERROR] failed to fetch pipeline id", error);
        throw error;
    }
}
