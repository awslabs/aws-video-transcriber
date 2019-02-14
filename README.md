## AWS Video Transcriber

The code provides a serverless single page web application and set of supporting API Gateway end points and Lambda functions which allow users to upload videos into S3 and compute and edit closed captions.

## On this Page
- [License](#license)
- [Architecture](#architecture)
- [Deploying](#deploying)
- [Pricing](#pricing)
- [Entering your API Key](#entering-your-api-key)
- [Creating a Vocabulary](#creating-a-vocabulary)
- [Creating Tweaks](#creating-tweaks)
- [Editing Captions](#editing-captions)
- [Downloading Captions](#downloading-captions)

## License

This library is licensed under the Apache 2.0 License. 

## Architecture

![Architecture](./web/img/architecture-001.png)

## Deploying

Prebuilt CloudFormation templates and assets have been deployed to AWS regions with both Amazon Transcribe and Amazon Elastic Transcoder. Click a button below to deploy to your region of choice.

When launching the template, you will need to enter a stack name and an API key, this is the key you will provide to users to access the system, use a strong, random, alpha-numeric API key up to 70 characters long.

### Once click deployment

| Region | Region Id | Deploy now |
| ---- | ----  | ---- |
| US East (N. Virginia) | us-east-1 | [![Launch Stack](web/img/launch-stack.svg)](https://us-east-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=us-east-1&stackName=&templateURL=https://s3-us-east-1.amazonaws.com/aws-captions-deployment-us-east-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| US West (N. California) | us-west-1 | [![Launch Stack](web/img/launch-stack.svg)](https://us-west-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=us-west-1&stackName=&templateURL=https://s3-us-west-1.amazonaws.com/aws-captions-deployment-us-west-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| US West (Oregon) | us-west-2 | [![Launch Stack](web/img/launch-stack.svg)](https://us-west-2.console.aws.amazon.com/cloudformation/home#/stacks/new?region=us-west-2&stackName=&templateURL=https://s3-us-west-2.amazonaws.com/aws-captions-deployment-us-west-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| EU (Ireland) | eu-west-1 | [![Launch Stack](web/img/launch-stack.svg)](https://eu-west-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=eu-west-1&stackName=&templateURL=https://s3-eu-west-1.amazonaws.com/aws-captions-deployment-eu-west-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| Asia Pacific (Singapore) | ap-southeast-1 | [![Launch Stack](web/img/launch-stack.svg)](https://ap-southeast-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=ap-southeast-1&stackName=&templateURL=https://s3-ap-southeast-1.amazonaws.com/aws-captions-deployment-ap-southeast-1/cloudformation/aws-video-transcriber-cloudformation.json) |
| Asia Pacific (Sydney) | ap-southeast-2 | [![Launch Stack](web/img/launch-stack.svg)](https://ap-southeast-2.console.aws.amazon.com/cloudformation/home#/stacks/new?region=ap-southeast-2&stackName=&templateURL=https://s3-ap-southeast-2.amazonaws.com/aws-captions-deployment-ap-southeast-2/cloudformation/aws-video-transcriber-cloudformation.json) |
| Asia Pacific (Mumbai) | ap-south-1 | [![Launch Stack](web/img/launch-stack.svg)](https://ap-south-1.console.aws.amazon.com/cloudformation/home#/stacks/new?region=ap-south-1&stackName=&templateURL=https://s3-ap-south-1.amazonaws.com/aws-captions-deployment-ap-south-1/cloudformation/aws-video-transcriber-cloudformation.json) |

### Accessing parameters after deployment

After launching the parameters will also provide the link to access the deployed website and the API key you entered above.

### Deploying to multiple regions

IAM roles and policies are global and are prefixed with the stack name, if you get conflicts, simply use a different stack name in each deployed region.

## Removing

To remove the solution delete the CloudFormation stack. Note that deletion will fail if you have not emptied to video, audio and transcribe buckets.

TODO add emptying these buckets to custom resource

## Pricing

You are responsible for the cost of the AWS services used while running the video transcription solution. As of the date of publication, the cost for running this solution in the US East (N.
Virginia) Region is shown in the table below. The cost depends on the number of length of uploaded videos, and does not include data transfer fees, which will vary
depending on the number of users and frequency of viewing.
		
Video transcoding costs (for non-MP4 videos):

	$0.03 per minute

Audio Transcoding costs:

	$0.0045 per minute

Transcribe costs:

	$0.024 per minute
	
[Amazon Transcribe Pricing](https://aws.amazon.com/transcribe/pricing/)

[Amazon Elastic Transcoder Pricing](https://aws.amazon.com/elastictranscoder/pricing/)

Pricing is quoyed per minute but Amazon Transcribe charges per second. Prices are subject to
change. For full details, see the pricing webpage for each AWS service for the region you deploy the solution to.

## Entering your API key

On the home page there is a button for entering your API key, locate your API key using the parameters tab of the CloudFormation service after deployment.

TODO screenshot of parameters
	
## Creating a Vocabulary

After deployment log into your site, click on the Vocabulary tab and create a custom vocabulary with at least one term. You might consider using:

	A.W.S.
	
TODO Screenshot of vocabulary screen
	
## Creating Tweaks

After deployment log into your site, click on the Tweaks tab and create a custom tweak configuration with at least one term. You might consider using:

	A.W.S.=AWS

TODO Screenshot of tweak screen

## Editing Captions

TODO details of editing videos

TODO Screenshot of video editing

## Downloading Captions

TODO details of downloading completed captions

TODO Screenshot of video workflow
