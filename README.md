## AWS Video Transcriber

This solution provides a serverless, single page web application and set of supporting API Gateway end points and backing Lambda functions which allow users to upload videos into S3 and compute and edit closed captions.

## On this Page
- [License](#license)
- [Architecture](#architecture)
- [Deploying the Solution](#deploying-the-solution)
- [Solution Pricing](#solution-pricing)
- [Launching the Website](#launching-the-website)
- [Entering your API Key](#entering-your-api-key)
- [Creating a Vocabulary](#creating-a-vocabulary)
- [Creating Tweaks](#creating-tweaks)
- [Listing Videos](#listing-videos)
- [Uploading Videos](#uploading-videos) 
- [Editing Captions](#editing-captions)
- [Downloading Captions](#downloading-captions)
- Support Appendix
  - [Troubleshooting Deployment](#troubleshooting-deployment)
  - [Removing the Solution](#removing-the-solution)
  - [Troubleshooting Solution Removal](#troubleshooting-solution-removal)

## License

This library is licensed under the Apache 2.0 License. 

## Architecture

![Architecture](./web/img/architecture-001.png)

## Deploying the Solution

Prebuilt CloudFormation templates and assets have been deployed to AWS regions with both Amazon Transcribe and Amazon Elastic Transcoder. Click a button below to deploy to your region of choice.

When launching the template, you will need to enter a stack name, an API key and choose a locale that Transcribe will use to process your video's audio data. 

*The API Key is used to provide to users access to the system. You must provide a strong, random, alpha-numeric API key between 20 and 70 characters long. Otherwise the stack will fail to launch and you will see [this error](#invalid-api-key).*

### One click deployment

| AWS Region Name | AWS Region Id | Deploy Solution |
| ---- | ----  | ---- |
| US East (N. Virginia) | us-east-1 | [![Launch Stack](web/img/launch-stack.svg)](https://us-east-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=us-east-1&stackName=&templateURL=https://s3.us-east-1.amazonaws.com/aws-captions-deployment-us-east-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| US West (N. California) | us-west-1 | [![Launch Stack](web/img/launch-stack.svg)](https://us-west-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=us-west-1&stackName=&templateURL=https://s3.us-west-1.amazonaws.com/aws-captions-deployment-us-west-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| US West (Oregon) | us-west-2 | [![Launch Stack](web/img/launch-stack.svg)](https://us-west-2.console.aws.amazon.com/cloudformation/home#/stacks/new?region=us-west-2&stackName=&templateURL=https://s3.us-west-2.amazonaws.com/aws-captions-deployment-us-west-2/cloudformation/aws-video-transcriber-cloudformation.json) |
| EU (Ireland) | eu-west-1 | [![Launch Stack](web/img/launch-stack.svg)](https://eu-west-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=eu-west-1&stackName=&templateURL=https://s3.eu-west-1.amazonaws.com/aws-captions-deployment-eu-west-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| Asia Pacific (Singapore) | ap-southeast-1 | [![Launch Stack](web/img/launch-stack.svg)](https://ap-southeast-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=ap-southeast-1&stackName=&templateURL=https://s3.ap-southeast-1.amazonaws.com/aws-captions-deployment-ap-southeast-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| Asia Pacific (Sydney) | ap-southeast-2 | [![Launch Stack](web/img/launch-stack.svg)](https://ap-southeast-2.console.aws.amazon.com/cloudformation/home#/stacks/new?region=ap-southeast-2&stackName=&templateURL=https://s3.ap-southeast-2.amazonaws.com/aws-captions-deployment-ap-southeast-2/cloudformation/aws-video-transcriber-cloudformation.json) |
| Asia Pacific (Mumbai) | ap-south-1 | [![Launch Stack](web/img/launch-stack.svg)](https://ap-south-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=ap-south-1&stackName=&templateURL=https://s3.ap-south-1.amazonaws.com/aws-captions-deployment-ap-south-1/cloudformation/aws-video-transcriber-cloudformation.json) |

![Stack parameters](manual/img/StackParameters.png)

## Solution Pricing

You are responsible for the cost of the AWS services used while running the video transcription solution. As of the date of publication, the costs for running this solution in the US East (N. Virginia) Region are shown in the table below. 

The cost depends on the number of and length of uploaded videos, and does not include data transfer fees, which will vary depending on the number of users and frequency of viewing.

You will also be charged for stored video and audio files in S3.
		
Video transcoding costs (for non-MP4 videos):

	$0.03 per minute

Audio Transcoding costs:

	$0.0045 per minute

Transcribe costs:

	$0.024 per minute
	
Amazon S3 Storage costs:

	$0.023 per GB per month

Pricing is quoted per minute but Amazon Transcribe actually charges per second. Prices are subject to change. For full details, see the pricing webpage for each AWS service for the region you deploy the solution to.

[Amazon Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/)

[Amazon Elastic Transcoder Pricing](https://aws.amazon.com/elastictranscoder/pricing/)

[Amazon S3 Pricing](https://aws.amazon.com/s3/pricing/)

## Launching the Website

Once you have deployed your stack, the link to your website is displayed in the *CloudFormation Outputs tab* along with your API Key. Click the *Website* link to access the site.

![CloudFormation outputs](manual/img/CloudFormationParameters.png)

## Entering your API key

On the home page there an *Enter API Key* button used for entering your API key, locate your API key using the *Outputs* tab of the CloudFormation service after deployment and enter it.

![Home page and API Key](manual/img/HomePage.png)	
## Creating a Vocabulary

After deployment and before uploading videos, log into your site, click on the *Vocabulary* page and create a custom vocabulary with at least one term. You might consider using:

	A.W.S.
	
You can enter up to 50kb of custom vocabulary terms, if you get a failure to save please read the [Amazon Transcribe formatting guide for custom vocabularies](https://github.com/awsdocs/amazon-transcribe-developer-guide/blob/master/doc_source/custom-vocabulary-files.md).
	
![Vocabulary page](manual/img/VocabularyPage.png)

You can add common terms for your business here such as brand names and industry specific terms to guide Transcribe in providing the best automated result.

After saving the vocabulary, Transcribe needs to train against the new vocabulary which can take several minutes. You are given visual feedback as to when this process is complete. Videos launched during this time will fail if the vocabulary is not in a ready state.
	
## Creating Tweaks

After deployment log into your site, click on the Tweaks tab and create a custom tweak configuration with at least one term. You might consider using:

	A.W.S.=AWS
	
Tweaks are used to transform common transcription issues you might find and also to correct Amazon Transcribe custom vocabulary verbatim transcriptions.

![Tweaks page](manual/img/TweaksPage.png)

## Listing Videos

The Videos page shows the current videos in the system and organizes them into tabs based on their processing status. You can search for videos here, start the caption editing process, trigger reprocessing, delete videos and download captions for completed videos.

![Videos page](manual/img/VideosPage.png)

## Uploading Videos

You can upload videos from any browser and launching the site on mobile allows users to capture and upload videos directly from a mobile phone.

Click on the *Upload Videos...* button to start the video upload process.

New AWS accounts have a service limit of 10 concurrent transcription jobs, this limit can be raised with an AWS service ticket. Videos launched above this threshold will fail and can be relaunched from the *Errored tab*.

## Editing Captions

Once your video has been transcribed you can tweak the captions to get things perfect. When first viewing the video, the system starts in a mode that pauses between each caption block, toggle this mode to view the video continuously.

You can also edit the video name and description here to assist in searching for the video and organising your video collection.

Once you have perfected the captions for a video, click the *Done* button to move the video to the completed tab.

The *Auto save* function flushes edits regularly to DynamoDB.

![Video page](manual/img/VideoPage.png)

## Downloading Captions

You can download completed captions from the [Caption editing page](#editing-captions) or from the table on the completed videos tab.

## Troubleshooting Deployment

### Deploying to multiple regions

IAM roles and policies are global and are prefixed with the stack name, if you get IAM role or policy conflicts, simply use a different stack name in each deployed region.

### Deploying multiple solution instances to a single AWS region

This is not currently supported but will be considered if there is customer demand. It will require all resources to be prefixed with the CloudFormation AWS::StackName pseudo parameter.

### Invalid API Key

If you see the following error while launching your CloudFormation stack:

![Invalid API Key](manual/img/InvalidKey.png)

Please verify the API Key you provided is between 20 and 70 characters long and only contains Alpha-Numeric characters, it uses the following regex:

	[a-zA-Z0-9]{20,70}
	
### CloudWatch log group already exists
	
If you are deploying to the same region after previously removing the stack you may see the following error:

![Log group exists](manual/img/LogGroupExists.png)

Simply delete the stack, go to the [CloudWatch Logs Console](https://console.aws.amazon.com/cloudwatch/home#logs) in the region and remove the dangling log group:

	/aws/lambda/prod-aws-captions-customresource

It can remain after a stack removal due to CloudWatch log flushing recreating the log group. Then simply deploy the CloudFormation stack once again.

### Custom Resource Creation Failures

Please raise a GitHub Issue with the error reported in the stack and we will investigate.

## Removing the Solution

To remove the solution delete the CloudFormation stack. Note that deletion will fail if you have not emptied the video, audio and transcribe buckets created as part of the stack.

## Troubleshooting Solution Removal

### CloudWatch log group not removed

After remove the stack, the [CloudWatch Log Group](https://console.aws.amazon.com/cloudwatch/home#logs) for the Lambda custom resource is left behind and must be manually removed before redeploying:

	/aws/lambda/prod-aws-captions-customresource

### S3 buckets not empty

CloudFormation will refuse to remove non-empty [S3 buckets](https://s3.console.aws.amazon.com/s3/home) so these must be manually emptied before removing the stack:

	prod-aws-captions-audio-<region>-<accountId>
	prod-aws-captions-video-<region>-<accountId>
	prod-aws-captions-transcribe-<region>-<accountId>

If you get this failure, empty the buckets using the [S3 console](https://s3.console.aws.amazon.com/s3/home) and try deleting the stack again.
	