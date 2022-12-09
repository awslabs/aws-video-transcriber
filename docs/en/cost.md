You are responsible for the cost of using Amazon Web Service's services used while running this solution. As of December 2022, the cost of the solution varies depending on:

- The number of requests to Amazon API Gateway
- The number of times AWS Lambda is invoked
- The number of Amazon DynamoDB reads/writes 
- The number of videos processed by AWS Elemental MediaConvert. The solution uses AWS Elemental MediaConvert to extract audios from videos or burn captions into videos.
- The number of audios that Amazon Transcribe processed. The solution uses Amazon Transcribe to extract text from audio and generate captions.
- The number of captions characters that Amazon Translate processed. The solution uses Amazon Translate to translate the captions to another language. **Currently, this is only supported by the deployment in AWS Standard Regions.**

## Example 1

In AWS China (Ningxia) Region operated by NWCD (cn-northwest-1), process 1 hour video, edit video captions for 500 times

The cost of using this solution to process the video is shown below:

| Service | Dimensions | Cost |
|---|---|---|
| AWS Elemental MediaConvert | Extract 1 hour audio | ¥1.24 |
| AWS Elemental MediaConvert | Burn captions into 1 hour video | ¥3.87 |
| Amazon Transcribe | Extract text from 1 hour audio | ¥9.72 |
| Amazon API Gateway | 500 requests | ¥0.015 |
| AWS Lambda | 500 requests (avg 300ms, 128MB Memory) | ¥0.00281 |
| Amazon DynamoDB | 1000 reads/writes | ¥0.007 |
|  |  | Total: ¥14.86 |

## Example 2

In US East (N. Virginia) Region (us-east-1), process 1 hour video, edit video captions for 500 times, tranlsate 10000 characters captions

The cost of using this solution to process this video is shown below:

| Service | Dimensions | Cost |
|---|---|---|
| AWS Elemental MediaConvert | Extract 1 hour audio | $0.18     |
| AWS Elemental MediaConvert | Burn captions into 1 hour video | $0.45     |
| Amazon Transcribe | Extract text from 1 hour audio | $1.44 |
| Amazon Translate | Tranlsate 10000 characters | $0.15 |
| Amazon API Gateway | 500 requests | $0.0017 |
| AWS Lambda | 500 requests (avg 300ms, 128MB Memory) | $0.0001 |
| Amazon DynamoDB | 1000 reads/writes | $0.00075 |
|  |  | Total: $2.22 |
