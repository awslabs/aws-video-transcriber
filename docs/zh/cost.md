您需要承担运行本解决方案时使用亚马逊云科技各个服务的成本费用。截至2021年12月，影响解决方案的成本因素主要包括：

- 每月向Amazon API Gateway发送请求的次数
- 每月调用Amazon Lambda的次数
- 每月读写Amazon DynamoDB的次数
- 每月使用Amazon Elemental MediaConvert处理视频的数量。本方案使用Amazon Elemental MediaConvert从视频提取音频或将字幕烧入到视频中
- 每月使用Amazon Transcribe处理音频的数量。本方案使用Amazon Transcribe从音频中提取文字，生成字幕
- 每月使用Amazon Translate翻译字幕的数量。本方案使用Amazon Translate将原字幕翻译成另一种语言

## 示例1: 以中国（宁夏）区域（cn-northwest-1)为例，每月处理100个视频，每个视频时长为1小时

使用本方案处理这些视频每月所需的成本费用如下表所示：

| 服务 | 用量 | 费用 |
|---|---|---|
| Amazon Elemental MediaConvert | 提取音频100小时 | ¥124.2 |
| Amazon Elemental MediaConvert | 烧入字幕100小时 | ¥387 |
| Amazon Transcribe | 语音转文字100小时 | ¥972 |
| Amazon API Gateway | 5万个请求 | ¥1.5 |
| Amazon Lambda | 10万次调用 （平均300ms，128M内存） | ¥0 |
| Amazon DynamoDB | 5万次读/写 | ¥0.6 |
|  |  | 总费用：¥1485.3 |

## 示例2: 以美国东部（弗吉尼亚北部）区域（us-east-1)为例，每月处理100个视频，每个视频时长为1小时

使用本方案处理这些视频每月所需的成本费用如下表所示：

| 服务 | 用量 | 费用 |
|---|---|---|
| Amazon Elemental Mediaconvert | 提取音频 100小时 | $18     |
| Amazon Elemental Mediaconvert | 烧入字幕 100小时 | $45     |
| Amazon Transcribe | 语音转文字 100小时 | $144 |
| Amazon Translate | 翻译文字 1百万字符 | $15 |
| Amazon API Gateway | 5万个请求 | $0.17 |
| Amazon Lambda | 10万次调用 （平均300ms，128M内存） | $0 |
| Amazon DynamoDB | 5万次读/写 | $0.06 |
|  |  | 总费用：$222.23 |
