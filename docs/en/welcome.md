This solution is based on [Amazon Lambda][lambda] serverless architecture, integrates services such as [Amazon Transcribe][transcribe], and provides a web console to help customers complete video caption related operations. For example, automatically generate video captions, proofread and edit captions comparing with video, translate captions, and generate video with captions.

This solution includes the following main functions:

- Captions generation: support MP4, MOV and MKV video's format; supports video within four hours（Due to [Amazon Transcribe Restriction][transcribe_restrict]）。
- Captions Editing: Support proofreading captions, editing captions, paragraph splitting and merging, captions mapping replacement.
- Captions translation: Support captions translation from the source language to the target language(**Only supported by the global regional deployment version**).
- Download captions: Download the generated captions as SRT or WEBVTT format.
- Make video with captions: Burn captions into video.

This solution is suitable for industries that need to generate video captions, such as education and media. For example, adding captions and translating captions to videos can greatly reduce labor costs and improve efficiency.

This implementation guide describes architectural considerations and configuration steps for deploying the Video Transcriber solution in the Amazon Web Services (AWS) cloud. It includes links to [CloudFormation][cloudformation] templates that launches and configures the AWS services required to deploy this solution using AWS best practices for security and availability.

The guide is intended for IT architects, developers, DevOps, data scientists, and algorithm engineers with practical experience architecting in the AWS Cloud.

[lambda]: https://aws.amazon.com/lambda/?nc1=h_ls
[transcribe]: https://aws.amazon.com/transcribe/?nc1=h_ls
[transcribe_restrict]: https://docs.aws.amazon.com/transcribe/latest/dg/input.html
[cloudformation]: https://aws.amazon.com/en/cloudformation/