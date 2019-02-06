
var fs = require('fs');
var AWS = require('aws-sdk');
var credentials = new AWS.SharedIniFileCredentials({profile: 'transcribe'});
AWS.config.credentials = credentials;
var s3 = new AWS.S3();

async function run () {

	try
	{
		var parameters = JSON.parse(fs.readFileSync('scripts/aws-captions-outputs.json'));

		console.log('Listing bucket: %s', parameters.WebBucket);

		var listParams = {
			Bucket: parameters.WebBucket
		};

		var objects = await s3.listObjects(listParams).promise();

		for (var i in objects.Contents)
		{
			var object = objects.Contents[i];
			console.log('Making public: s3://%s/%s', parameters.WebBucket, object.Key);

			var putACLParams = {
				Bucket: parameters.WebBucket,
				Key: object.Key,
				ACL: 'public-read'
			};

			var result = await s3.putObjectAcl(putACLParams).promise();
		}
	}
	catch (error)
	{
		console.log('[ERROR] Failed to make objects public', error);
		throw error;
	}

}

if (require.main == module)
{
	run();
}

