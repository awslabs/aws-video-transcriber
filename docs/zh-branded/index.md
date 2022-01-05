视频字幕解决方案基于[Amazon Lambda][lambda]无服务器架构，集成[Amazon Transcribe][transcribe]等服务，并提供网页控制台帮助客户完成视频字幕相关操作。例如，自动生成视频字幕，对照视频校对和编辑字幕，翻译字幕以及生成硬字幕视频。

本解决方案主要包括以下功能：

- 字幕生成：为上传的视频自动生成字幕。支持MP4、MOV和MKV的视频格式；支持四个小时以内的视频（基于[Amazon Transcribe的限制][transcribe_restrict]）。
- 字幕编辑：支持对照视频校对字幕、编辑字幕、段落拆分与合并，字幕映射和字幕替换。
- 字幕翻译：支持从源语言翻译成目标语言，并生成字幕。**目前仅全球区域部署版本支持。**
- 字幕下载：将已经生成的字幕下载成SRT或WEBVTT格式的字幕。
- 硬字幕制作：客户可以将已经生成好的字幕烧入视频中，并下载带字幕的视频。

本解决方案适用于教育、媒体等需要处理视频字幕的行业。例如，对视频精准添加字幕和翻译字幕等场景，都可以大幅减少人工成本，提高效率。

本实施指南介绍在Amazon Web Services（亚马逊云科技）云中部署视频字幕解决方案的架构信息和具体配置步骤。它包含指向[CloudFormation][cloudformation]模板的链接，这些模板使用亚马逊云科技在安全性和可用性方面的最佳实践来启动和配置本解决方案所需的亚马逊云科技服务。

本指南面向具有亚马逊云科技架构实践经验的IT架构师、开发人员、DevOps工程师、数据科学家和算法工程师等专业人士。

[lambda]: https://aws.amazon.com/cn/lambda/
[transcribe]: https://aws.amazon.com/cn/transcribe/
[transcribe_restrict]: https://docs.aws.amazon.com/zh_cn/transcribe/latest/dg/input.html
[cloudformation]: https://aws.amazon.com/en/cloudformation/