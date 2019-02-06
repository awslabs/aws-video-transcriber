
var fs = require('fs');

function handler (data, serverless, options) {
 	// Log the created dynamoDB tables
 	console.log('tables:');
 	console.log(' config: ' + data.ConfigDynamoDBTable);
 	console.log(' video: ' + data.VideoDynamoDBTable);
 	console.log(' caption: ' + data.CaptionDynamoDBTable);

 	console.log('buckets:');
 	console.log(' video: ' + data.VideoBucket);
 	console.log(' audio: ' + data.AudioBucket);
 	console.log(' transcribe: ' + data.TranscribeBucket);
 	console.log(' site: ' + data.WebBucket);

 	console.log('transcoder:');
 	console.log(' audiopipeline: ' + data.TranscoderAudioPipelineName);
 	console.log(' videopipeline: ' + data.TranscoderVideoPipelineName);

	console.log('IAM:');
 	console.log(' transcoderRole: ' + data.TranscoderRoleARN);

	console.log('API:');
 	console.log(' url: ' + data.APIUrl);
 	
 	var config = {
		version: "1.1",
		api_base: data.APIUrl,
		api_videos: "/videos",
		api_vocabulary: "/vocabulary",
		api_tweaks: "/tweaks",
		api_video: "/video",
		api_videostatus: "/videostatus",
		api_videoname: "/videoname",
		api_videodescription: "/videodescription",
		api_captions: "/caption",
		api_upload: "/upload"
 	};

	fs.writeFile('web/site_config.json', JSON.stringify(config), function (error) 
	{
	    if (error) 
	    {
	    	console.log('[ERROR] failed to write web config', error);
    	    throw error;
	    }
	});

}

module.exports = { handler }

