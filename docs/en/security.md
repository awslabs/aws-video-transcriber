When you build systems on AWS infrastructure, security responsibilities are shared between you and AWS. This [shared model](https://aws.amazon.com/compliance/shared-responsibility-model/) reduces your operational burden because AWS operates, manages, and controls the components including the host operating system, the virtualization layer, and the physical security of the facilities in which the services operate. For more information about AWS security, visit [AWS Cloud Security](http://aws.amazon.com/security/).

## IAM roles

AWS Identity and Access Management (IAM) roles allow customers to assign granular access policies and permissions to services and users on the AWS Cloud. This solution creates IAM roles that grant the solution’s access between the solution components.

## MediaConvert Policy

The MediaConvert policy is created in this solution to allows AWS Elemental MediaConvert to access Amazon S3 buckets.

## Lambda Policy

The Lambda policy is created in this solution to allows AWS Lambda Functions to access Amazon DynamoDB, AWS Elemental MediaConvert, Amazon Transcribe and Amazon Translate services.