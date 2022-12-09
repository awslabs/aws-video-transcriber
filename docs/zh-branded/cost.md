您需要承担运行视频字幕解决方案时使用亚马逊云科技各个服务的成本费用。截至2022年12月，影响解决方案的成本因素主要包括：

- 向Amazon API Gateway发送请求的次数。
- 调用Amazon Lambda的次数。
- 读写Amazon DynamoDB的次数。
- 使用Amazon Elemental MediaConvert处理视频的数量。本方案使用Amazon Elemental MediaConvert从视频提取音频或将字幕烧入到视频中。
- 使用Amazon Transcribe处理音频的数量。本方案使用Amazon Transcribe从音频中提取文字，生成字幕。
- 每月使用Amazon Translate翻译字幕的数量。本方案使用Amazon Translate将原字幕翻译成另一种语言。**目前仅全球区域部署版本支持。**

## 示例1

以由西云数据运营的亚马逊云科技中国（宁夏）区域（cn-northwest-1）为例，处理时长1小时视频，编辑操作500次

使用本方案处理此视频所需的成本费用如下表所示：

| 服务 | 用量 | 费用 |
|---|---|---|
| Amazon Elemental MediaConvert | 提取音频1小时 | ¥1.24 |
| Amazon Elemental MediaConvert | 烧入字幕1小时 | ¥3.87 |
| Amazon Transcribe | 语音转文字1小时 | ¥9.72 |
| Amazon API Gateway | 500个请求 | ¥0.015 |
| Amazon Lambda | 1000次调用 （平均300ms，128MB内存） | ¥0 |
| Amazon DynamoDB | 500次读/写 | ¥0.006 |
|  |  | 总费用：¥14.85 |

## 示例2

以美国东部（弗吉尼亚北部）区域（us-east-1）为例，处理时长1小时视频，编辑操作500次，翻译字幕1万个字符

使用本方案处理此视频所需的成本费用如下表所示：

| 服务 | 用量 | 费用 |
|---|---|---|
| Amazon Elemental MediaConvert | 提取音频1小时 | $0.18     |
| Amazon Elemental MediaConvert | 烧入字幕1小时 | $0.45     |
| Amazon Transcribe | 语音转文字1小时 | $1.44 |
| Amazon Translate | 翻译文字1万字符 | $0.15 |
| Amazon API Gateway | 500个请求 | $0.0017 |
| Amazon Lambda | 1000次调用 （平均300ms，128MB内存） | $0 |
| Amazon DynamoDB | 500次读/写 | $0.0006 |
|  |  | 总费用：$2.22 |
