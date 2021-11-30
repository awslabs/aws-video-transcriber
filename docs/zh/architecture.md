下图展示的是使用默认参数部署本解决方案在亚马逊云科技中构建的环境。

![architecture](./images/Video-Transcriber-Architecture.png)
      
图：方案架构

本解决方案在您的亚马逊云科技账户中部署Amazon CloudFormation模板并完成以下设置。

1. [Amazon S3][s3] (Web App)保存前端静态文件
2. 客户端通过[Amazon API Gateway][api-gateway]发送请求
3. [Amazon Lambda][lambda] Function接收Amazon API Gateway的请求，处理本方案的业务逻辑
4. 客户端从Amazon Lambda获得signURL之后上传需要处理的视频
5. Amazon Lambda Function从[Amazon DynamoDB][dynamodb]中获取/更新视频的相关信息
6. Amazon Lambda Function调用[Amazon Elemental MediaConvert][mediaconvert]进行视频处理，包括从视频中提取音频和将字幕烧入视频中，并将结果保存到Amazon S3 (Videos and Captions)
7. Amazon Lambda Function调用[Amazon Transcribe][transcribe]从音频中提取字幕，并将结果保存到Amazon S3 (Videos and Captions)
8. Amazon Lambda Function调用[Amazon Translate][translate]将字幕翻译成其它语言，并将结果保存到Amazon S3 (Videos and Captions)

本方案在Amazon S3存储桶中部署了一个Web应用，S3存储桶只能通过CloudFront访问。

Amazon API Gateway通过API Key进行认证，客户端必须输入正确的API Key才能访问Amazon API Gateway。

[s3]: https://aws.amazon.com/cn/s3/
[api-gateway]: https://aws.amazon.com/cn/api-gateway/
[lambda]: https://aws.amazon.com/cn/lambda/
[dynamodb]: https://aws.amazon.com/cn/dynamodb/
[mediaconvert]: https://aws.amazon.com/cn/mediaconvert/
[transcribe]: https://aws.amazon.com/cn/transcribe/
[translate]: https://aws.amazon.com/cn/translate/