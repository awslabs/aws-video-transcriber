## AWS Video Transcriber

This solution is built on AWS Lambda serverless architecture, the solution integrates
services such as Amazon Transcribe, Amazon Translate and Amazon Elemental MediaConvert to help customers complete video caption related
operations on a web interface. For example, automatically generating video captions,
proofreading and editing video captions, translating captions, and burning captions into
videos.

## Architecture
![architecture](./docs/en/images/Video-Transcriber-Architecture.png)

## Deploying the Solution

Prebuilt CloudFormation templates and assets have been deployed to AWS regions with both Amazon Transcribe and Amazon Elemental MediaConvert. When launching the template, you will need to enter a stack name, an API key and choose a language as default language that Transcribe will use to process your video's audio data. You can still select language before upload the video to process

The API Key is used to provide to users access to the system. You must provide a strong, random, alpha-numeric API key between 20 and 70 characters long. Otherwise the stack will fail to launch and you will see "Invalid Key Error"
![Invalid Key Error](./docs/img/InvalidKey.png)


### One click deployment

| AWS Region Name | AWS Region Id | Deploy Solution |
| ---- | ----  | ---- |
| US East (N. Virginia) | us-east-1 | [![Launch Stack](./docs/img/launch-stack.svg)](https://console.aws.amazon.com/cloudformation/home?region=us-east-1#/stacks/create/template?stackName=VideoTranscriber&templateURL=https://aws-gcr-solutions.s3.amazonaws.com/Video-Transcriber/latest/video-transcriber-deploy.template) |
| China (Beijing) | cn-north-1 | [![Launch Stack](./docs/img/launch-stack.svg)](https://cn-north-1.console.amazonaws.cn/cloudformation/home?region=cn-north-1#/stacks/create/template?stackName=VideoTranscriber&templateURL=https://aws-gcr-solutions.s3.cn-north-1.amazonaws.com.cn/Video-Transcriber/latest/video-transcriber-deplo-cn.template) |
| China (Ningxia) | cn-northwest-1 | [![Launch Stack](./docs/img/launch-stack.svg)](https://cn-northwest-1.console.amazonaws.cn/cloudformation/home?region=cn-northwest-1#/stacks/create/template?stackName=VideoTranscriber&templateURL=https://aws-gcr-solutions.s3.cn-north-1.amazonaws.com.cn/Video-Transcriber/latest/video-transcriber-deplo-cn.template) |

![Stack parameters](./docs/img/stack-info.png)

## Solution Pricing

You are responsible for the cost of using Amazon Web Service's services used while running this solution. As of December 2021， the cost of the solution varies depending on:

- The number of requests to Amazon API Gateway
- The number of invoking AWS Lambda 
- The number of read/write Amazon DynamoDB
- The number of videos that AWS Elemental MediaConvert processed. The solution uses AWS Elemental MediaConvert to extract audios from videos or burn captions into videos
- The number of audios that Amazon Transcribe processed. The solution uses Amazon Transcribe to extract text from audio and generate captions
- The number of captions characters that Amazon Translate processed. The solution uses Amazon Translate to translate the captions to another language. 

## Example: In US East (N. Virginia) Region（us-east-1), process 1 hour video, edit video captions for 500 times，tranlsate 10000 characters captions

The cost of using this solution to process this video is shown below:

| Service | Dimensions | Cost |
|---|---|---|
| AWS Elemental MediaConvert | Extract 1 hour audio | $0.18     |
| AWS Elemental MediaConvert | Burn captions into 1 hour video | $0.45     |
| Amazon Transcribe | Extract text from 1 hour audio | $1.44 |
| Amazon Translate | tranlsate 10000 characters | $0.15 |
| Amazon API Gateway | 500 requests | $0.0017 |
| AWS Lambda | 500 requests （avg 300ms，128MB Memory） | $0.0001 |
| Amazon DynamoDB | 1000 read/write | $0.00075 |
|  |  | Total：$2.22 |

## Access the web interface

After the stack is successfully created, you can view the authentication information (**APIKey**) required to access the web interface and the created CloudFront URL (**ConsoleUrl**) on the **Outputs** tab of AWS CloudFormation stack.

1. Enter the CloudFront URL in the address bar of the browser.

2. Select **Enter API Key**, and enter the authentication information in the pop-up input box.

## Upload videos and perform operations related to video captions

In the web interface, select **Videos** at the top of the page. The page displays four tabs, corresponding to the different status of videos:

- Videos being processed
- Videos ready for editing
- Videos marked as editing completed
- Videos with errors during processing

![](./docs/en/images/user-guide-video-management.png)

### Upload video

You can upload videos without captions for processing.

1. On the **Videos** page, select **Upload videos...**.

2. Select the video, then select **Open**.

3. Select the video language, and then choose **Start**. The system will start uploading the video and automatically process and generate captions.

    Firstly, the video is displayed on the **Processing** tab, and after the captions are generated, the video will be displayed on the **Ready to edit** tab.

### Proofread and edit captions 

You can proofread and edit the video captions.

1. On the **Videos** page, select the **Ready to edit** tab.

2. Select the language link from the **Video Language** column to enter the captions editing page. The functions include:
- Play the video content paragraph by paragraph to proofread the captions.
- Modify the captions.
- Merge or split captions parapraphs.

### Translate captions

You can translate the video captions, and then proofread and edit translated captions.
**Note: Currently, this feature is only supported by the deployment in AWS Standard Regions.**

1. On the captions editing page, select **Translate to**.

2. After selecting the target language in the drop-down list, the system will translate the captions into the target language. After the translation is completed, you can also proofread and edit the translated captions.

![](./docs/en/images/user-guide-video-translate.png)
![](./docs/en/images/user-guide-video-translate-1.png)

### Burn captions into the video
You can burn the generated captions into the video to create the video with captions.

1. On the **Videos** page, select the **Ready to edit** tab.

2. Select the language link from the **Video Language** column to enter the captions editing page.

3. Select **Burn in**。
![](./docs/en/images/user-guide-video-burn.png)

### Download captions or video with captions

After the captions or videos with captions are generated, you can download them directly:

- If the video is in the editing status, select the video and the corresponding language to enter the video editing page to download.
![](./docs/en/images/user-guide-video-download-1.png)

- If the video is in the completed status, you can directly download the captions or videos in the corresponding language of the video on the **Completed** tab of the **Videos** page.
![](./docs/en/images/user-guide-video-download-2.png)

## License

This library is licensed under the Apache 2.0 License.	