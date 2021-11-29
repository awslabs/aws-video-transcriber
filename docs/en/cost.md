您需要承担运行此解决方案时使用亚马逊云科技各个服务的费用。截止2021年12月，此解决方案主要包括以下费用：

- 每月向Amazon API Gateway发送的请求的次数
- 每月调用Amazon Lambda的次数
- 每月读写Amazon DynamoDB的次数
- 每月使用Amazon Elemental Mediaconvert处理视频的数量。此方案使用Amazon Elemental Mediaconvert从视频提取音频或将字幕烧入到视频中
- 每月使用Amazon Transcribe处理音频的数量。此方案使用Amazon Transcribe从音频中提取文字，生成字幕
- 每月使用Amazon Translate翻译字幕的数量。此方案使用Amazon Translate将原字幕翻译成另一种语言

下表以美东1（N. Virginia)为例，每月处理100个视频，每个视频一个小时，该方案每月所需的费用。
| 服务        | 用量                          | 费用     |
| ----------- | ------------------------------------ |
| Amazon Elemental Mediaconvert       | 提取音频 100小时        |   $18    ｜
| Amazon Elemental Mediaconvert       | 烧入字幕 100小时        |   $45    ｜
| Amazon Transcribe                   | 语音转文字 100小时       |   $144   |
| Amazon Translate                    | 翻译文字 1百万字符       |   $15    |
| Amazon API Gateway                  | 5万个请求               |   $0.17  |
| Amazon Lambda                       | 10万次调用 （平均300ms，128M内存）               |   $0  |
| Amazon DynamoDB                     | 5万次读/写               |   $0.06   |
|                                     |                       |   总费用：$222.23   |