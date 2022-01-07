Built on [Amazon Lambda][lambda] serverless architecture, the Video Transcriber solution integrates services such as [Amazon Transcribe][transcribe] to help customers complete video caption related operations on a web interface, for example, automatically generating video captions, proofreading and editing video captions, translating captions, and burning captions into videos.

The solution includes the following main functions:

- Generating captions: supports uploading MP4, MOV and MKV videos; supports videos within four hours according to [Amazon Transcribe Restriction][transcribe_restrict].
- Editing captions: supports proofreading, editing, paragraph splitting and merging, mapping, and replacement of captions.
- Translating captions: supports translation from the source language to the target language. **Currently, this is only supported by the deployment in Amazon Web Services Standard Regions.**
- Downloading captions: supports SRT or WEBVTT.
- Burning captions: supports burning generated captions into videos, and then downloading the videos with captions.

The Video Transcriber solution is intended for customers with video caption processing requirements in industries like education or media. Specifically, customers can use the solution to generate video captions precisely or translate video captions with lower cost and higher efficiency.

This implementation guide describes architectural considerations and configuration steps for deploying the Video Transcriber solution in the Amazon Web Services cloud. It includes links to [CloudFormation][cloudformation] templates that launch and configure the services required to deploy this solution using Amazon Web Services best practices for security and availability.

The guide is intended for IT architects, developers, DevOps professionals, data scientists, and algorithm engineers with practical experience architecting in the Amazon Web Services Cloud.

[lambda]: https://aws.amazon.com/lambda
[transcribe]: https://aws.amazon.com/transcribe
[transcribe_restrict]: https://docs.aws.amazon.com/transcribe/latest/dg/input.html
[cloudformation]: https://aws.amazon.com/en/cloudformation/