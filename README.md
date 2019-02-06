## AWS Video Transcriber

The code provides a serverless single page web application and set of supporting API Gateway end points and Lambda functions which allow users to upload videos into S3 and compute and edit closed captions.

## License

This library is licensed under the Apache 2.0 License. 

## Architecture

![Architecture](./web/img/architecture-001.png)

## Preparing for deployment

### Install or update your AWS CLI

	pip install --upgrade awscli

### Create an IAM user

The deployment files are configured to rely on a [local named AWS profile](https://docs.aws.amazon.com/cli/latest/userguide/cli-multiple-profiles.html) called **transcribe**. 

Create an user with IAM Admin permissions and generate an AWS IAM Access Key and Secret key using the AWS console.

*Note your AWS Account number from the IAM console, you will need this later.*

### Created the named AWS profile

Create the named profile with these credentials using:

	aws configure --profile transcribe
	
Entering your access key and secret key wehn prompted and for region use us-west-2, leaving the output default as JSON.

### Install Homebrew and Node.js

The system uses [Node.js](https://nodejs.org/en/) and the [Serverless Framework](https://serverless.com/) for deployment and relies on several Serverless plugins. These must be setup preior to deployment.

Follow the instructions [here](https://www.dyclassroom.com/howto-mac/how-to-install-nodejs-and-npm-on-mac-using-homebrew) to install Homebrew and Node.js.

If you have an old Node.js update it to 6.4.1+ with:

	npm i -g npm

### Install Serverless

[Install the serverless framework](https://serverless.com/framework/docs/providers/aws/guide/installation/):

	npm install -g serverless
	
### Install the required Serverless plugins

These are referenced in the package.json

	npm install
	
### Deploy the AWS Node.js SDK Layer

The system relies on some later features in the AWS SDK (noteably deleting existing Transcribe jobs) so a Lambda Layer has been prepared to reduce the weight of delpoyed Lambda code.

To build and deploy the layer run:

	cd layers/nodejs
	npm install
	cd ..
	serverless deploy --accountId <accountId>
	
Several Lambda functions deployed later will rely on this layer and will fail to run without it.
	
## Create a default role for Elastic Transcoder

Create a new IAM role for Elastic Transcoder if it doesn't exist called:

	Elastic_Transcoder_Default_Role
	
Add a trust relationship to: 

	elastictranscoder.amazonaws.com
	
Use this IAM JSON policy:

~~~~
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:Put*",
                "s3:ListBucket",
                "s3:*MultipartUpload*",
                "s3:Get*"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": "sns:Publish",
            "Resource": "*"
        },
        {
            "Effect": "Deny",
            "Action": [
                "s3:*Delete*",
                "s3:*Policy*",
                "sns:*Remove*",
                "sns:*Delete*",
                "sns:*Permission*"
            ],
            "Resource": "*"
        }
    ]
}
~~~~

## Deploying to AWS

### Deploying the AWS server components

The following steps deploy the system to your AWS account. You will need your AWS account number and to substitute it in the commands below.

To deploy to AWS use:

	serverless deploy \
		--accountId <your AWS account id> \
		[--stage <stage name>]
	
To undeploy from AWS use:

	serverless remove \
		--accountId <your AWS account id> \
		[--stage <stage name>]
		
Stage name is optional and defaults to:
	
	dev

Note that you may need to empty your S3 buckets before you can remove, or manually remove the CloudFormation stack from the AWS Console if you get stuck undeploying.

The above steps deploy a CloudFormation template that creates S3 buckets, DynamoDB tables, API Gateway end points and Lambda functions.

### Deploying the static web site to S3

The [Serverless Finch](https://github.com/fernando-mc/serverless-finch) plugin is used to deploy the client web application to S3. A configuration file is created in the previous step and is deployed with the public website:

	web/site_config.json
	
This contains the latest API Gateway URL for the client to use.

To deploy the client to AWS, creating a new bucket use:

	serverless client deploy \
		--accountId <your AWS account id> \
		[--stage <stage name>]
	
**Note that this will create a public S3 bucket which is frowned upon especially for AWS staff!**

To create a non-public bucket with public objects use the following deployment command:

	serverless client deploy \
		--accountId <your AWS account id> \
		--no-policy-change \
		--no-config-change \
		[--stage <stage name>]
	
You will currently need to make all content public using the S3 console, a [feature request raised to the Serverless Finch team](https://github.com/fernando-mc/serverless-finch/issues/69).

In the interim you may make all files in the site bucket public using the following script:
	
	node scripts/makePublic.js

Removal of the client can be achieved through:

	serverless client remove \
		--accountId <your AWS account id> \
		[--stage <stage name>]
	
## Creating a Transcribe Vocabulary

Prior to uploading your first video, use the Vocabulary menu in the web app to create a vocabulary, a sample is available in the source code at:

	config/sample_vocabulary.txt
	
## Testing remotely

The link published in the terminal by Serverless Finch is not optimal as it doesn't support HTTPS. Use the following format:

	https://s3-<region>.amazonaws.com/<stage>-aws-captions-site-<region>-<account id>/index.html#

## Testing locally

Open a terminal prompt and change into the web folder. Use the following command to open a local HTTP server on port 8000:

	cd web/
	python -m http.server
	
## Entering your API key

On the home page there is a button for entering your API key, find your API key using the AWS Console in the API Gateway after deployment.

## TODO

* [ ] Bug when video autorewinds but does not reset caption index to zero
* [ ] Validate video max length 2 hours
* [ ] Multiple vocabularies / locales
* [ ] Pick locale / vocabulary
* [ ] Expert mode see all captions and edit?
* [ ] Validate caption times on save
* [ ] Make content public after deploy (manual step)
* [ ] Blog
* [ ] Serverless Finch open tickets
* [x] Private GitHub repository
* [x] Preserve name and description during re-runs
* [x] Rename videos and edit description
* [x] Search videos based on description
* [x] Hide view video links for Processing tab
* [x] Mark as complete
* [x] Namespace table and buckets using service name
* [x] Delete videos
* [x] Reprocess videos
* [x] Tab badges for videos
* [x] Select last tab
* [x] Default tab to last selected for videos
* [x] Add caption blocks past the end of video bug
* [x] Play to end of video play bug
* [x] Document Elastic Transcoder service linked role
* [x] Delete previous transcribe jobs
* [x] List of errored jobs
* [x] Handle transcribe service limits (retry)
* [x] Refresh on videos page
* [x] Login system
* [x] Auth system for Lambda (API keys)
* [x] API Gateway end points
* [x] Video caption editor
* [x] Download of captions
* [x] Lambda for Transcode
* [x] Lambda for Transcribe
* [x] Lambda for Captions
* [x] Lambda for Comprehend
* [x] Lambda IAM role per function
* [x] Dynamo Schema
* [x] Cloudformation - serverless
* [x] Update diagram
* [x] Upload video function
* [x] S3 CORS
* [x] Auto save captions every 20 seconds


# Data below this is just rough notes

## Custom vocabularies

	https://docs.aws.amazon.com/transcribe/latest/dg/how-it-works.html#how-vocabulary

## Building the front end

	https://www.sitepoint.com/single-page-app-without-framework/
	
	https://github.com/Graidenix/vanilla-router
	
	https://getbootstrap.com/docs/4.0/getting-started/introduction/
	
	http://handlebarsjs.com/
	
	https://medium.com/codingthesmartway-com-blog/getting-started-with-axios-166cb0035237
	
	https://datatables.net/
	
	https://loading.io/

## Convert DynamoDB responses:

	https://gist.github.com/igorzg/c80c0de4ad5c4028cb26cfec415cc600

## Define GSI

	https://gist.github.com/DavidWells/c7df5df9c3e5039ee8c7c888aece2dd5

## Async Lambda node 8.10

	https://aws.amazon.com/blogs/compute/node-js-8-10-runtime-now-available-in-aws-lambda/

## Deploying using Serverless

pip install --upgrade awscli

Install globally:

	npm i -g serverless
	npm i serverless-stack-output
	npm i serverless-finch
	npm i serverless-plugin-scripts
	npm i aws-sdk (Optional)

	https://serverless.com/blog/serverless-express-rest-api/
	
	https://github.com/serverless/examples/blob/master/aws-node-rest-api-with-dynamodb/serverless.yml
	
	https://github.com/serverless/examples/tree/master/aws-node-env-variables
	
List of all lifecycle events in Serverless:

	https://gist.github.com/HyperBrain/bba5c9698e92ac693bb461c99d6cfeec#package

## Limit increase for Transcribe

And handle errors when queue is full

## CORS survival guide

	https://serverless.com/blog/cors-api-gateway-survival-guide/
	
## Lifecycle hooks:
	
	https://gist.github.com/HyperBrain/50d38027a8f57778d5b0f135d80ea406
	
## Bug for S3 bucket events CORS:

	Created

## Update available 5.3.0 → 6.4.1

	Run npm i -g npm to update 

## Elastic transcoder

	https://github.com/ACloudGuru/serverless-framework-video-example/blob/master/backend/transcode-video-firebase-enabled/index.js

## Blog examples

	https://aws.amazon.com/blogs/machine-learning/discovering-and-indexing-podcast-episodes-using-amazon-transcribe-and-amazon-comprehend/

	https://aws.amazon.com/blogs/compute/implementing-serverless-video-subtitles/

	https://aws.amazon.com/blogs/machine-learning/get-started-with-automated-metadata-extraction-using-the-aws-media-analysis-solution/

## Dropzone upload directly to S3

	https://stackoverflow.com/questions/34526851/upload-files-to-amazon-s3-with-dropzone-js-issue
	
	starts-with signing
	https://cwhite.me/avoiding-the-burden-of-file-uploads/
	
	https://gist.github.com/chrisseto/8828186#file-put-upload-to-s3-via-dropzone-js
	
	https://tutorialzine.com/2017/07/javascript-async-await-explained

## Styling dropzone

	https://codepen.io/fuxy22/pen/pyYByO

## Step functions

	https://serverless.com/blog/how-to-manage-your-aws-step-functions-with-serverless/

