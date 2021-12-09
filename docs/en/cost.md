You are responsible for the cost of using Amazon Web Service's services used while running this solution. As of December 2021, the factors affecting the cost of the solution include:

- The number of request to Amazon API Gateway
- The number of invoking Amazon Lambda
- The number of read/write Amazon DynamoDB
- The number of videos that Amazon Elemental MediaConvert process. The solution uses Amazon Elemental MediaConvert to extract audios from videos or burn captions into videos
- The number of audio that Amazon Transcribe process。The solution uses Amazon Transcribe to extract text from audio
- The number of captions characters that Amazon Translate process. The solution uses Amazon Translate to translate the captions to another language. **Only support Global Region**

## Example 1: In Ningxia (cn-northwest-1) Region operated by NWCD，process 1 hour video, edit video captions for 500 times

The cost of using this solution to process this video display as below:

| Service | Dimensions | Cost |
|---|---|---|
| Amazon Elemental MediaConvert | Extract 1 hour audio | ¥1.24 |
| Amazon Elemental MediaConvert | Burn captions into 1 hour video | ¥3.87 |
| Amazon Transcribe | Extract text from 1 hour audio | ¥9.72 |
| Amazon API Gateway | 500 requests | ¥0.015 |
| Amazon Lambda | 500 requests （avg 300ms，128M Memory） | ¥0.00281 |
| Amazon DynamoDB | 1000 read/write | ¥0.007 |
|  |  | 总费用：¥14.86 |

## Example 2: In US East (N. Virginia) Region, process 1 hour video, edit video captions for 500 times，tranlsate 10000 characters captions

The cost of using this solution to process this video display as below:

| Service | Dimensions | Cost |
|---|---|---|
| Amazon Elemental MediaConvert | Extract 1 hour audio | $0.18     |
| Amazon Elemental MediaConvert | Burn captions into 1 hour video | $0.45     |
| Amazon Transcribe | Extract text from 1 hour audio | $1.44 |
| Amazon Translate | tranlsate 10000 characters | $0.15 |
| Amazon API Gateway | 500 requests | $0.0017 |
| Amazon Lambda | 500 requests （avg 300ms，128M Memory） | $0.0001 |
| Amazon DynamoDB | 1000 read/write | $0.00075 |
|  |  | 总费用：$2.22 |
