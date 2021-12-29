When you build systems on Amazon Web Services infrastructure, security responsibilities are shared between you and Amazon Web Services. This [shared model](https://aws.amazon.com/compliance/shared-responsibility-model/) reduces your operational burden because Amazon Web Services operates, manages, and controls the components including the host operating system, the virtualization layer, and the physical security of the facilities in which the services operate. For more information about Amazon Web Services security, visit [Amazon Web Services Cloud Security](http://aws.amazon.com/security/).

## IAM roles

Amazon Web Services Identity and Access Management (IAM) roles allow customers to assign granular access policies and permissions to services and users on the Amazon Web Services Cloud. This solution creates IAM roles that grant the solution’s access between the solution components.

## MediaConvert Policy

The MediaConvert policy is created in this solution to allows Amazon Elemental MediaConvert to access Amazon S3 buckets.

## Lambda Policy

The Lambda policy is created in this solution to allows Amazon Lambda Functions to access Amazon DynamoDB, Amazon Elemental MediaConvert, Amazon Transcribe and Amazon Translate services.