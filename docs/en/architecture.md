The below diagram shows the environment built in Amazon Web Service by using the default parameters to deploy this solution.

![architecture](./images/Video-Transcriber-Architecture.png)

Picture: Solution Architecture

This solution deploys the Amazon CloudFormation template in your Amazon Web Service account and completes the below settings.

1. [Amazon S3][s3] (Web App) Store front-end static files
2. Client side sends the request through [Amazon API Gateway][api-gateway]
3. [Amazon Lambda][lambda] Function receive the request from Amazon API Gateway, and process the solution's business logic
4. 4. Client side gets the signURL from Amazon Lambda, then uploads the video
5. Amazon Lambda Function gets/updates videos' profile from [Amazon DynamoDB][dynamodb]
6. Amazon Lambda Function invokes [Amazon Elemental MediaConvert][mediaconvert] to process video，included extracting audio from video and burning captions into video and store the result into Amazon S3 (Videos)
7. Amazon Lambda Function invokes [Amazon Transcribe][transcribe] captions from audio and store the result into Amazon S3 (Captions)
8. Amazon Lambda Function invokes [Amazon Translate][translate] to translate captions to another language and store the result into Amazon S3 (Captions)

The solution deploys a Web application into Amazon S3 bucket，the resources in Amazon S3 just can be accessed through Amazon CloudFront。

Amazon API Gateway authenticates through API Key, and clients must enter the correct API Key to access Amazon API Gateway.

[s3]: https://aws.amazon.com/s3/
[api-gateway]: https://aws.amazon.com/api-gateway/
[lambda]: https://aws.amazon.com/lambda/
[dynamodb]: https://aws.amazon.com/dynamodb/
[mediaconvert]: https://aws.amazon.com/mediaconvert/
[transcribe]: https://aws.amazon.com/transcribe/
[translate]: https://aws.amazon.com/translate/