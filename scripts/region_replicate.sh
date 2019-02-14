#!/bin/bash

# Copies deployment assets into multiple regions

sourceRegion="ap-southeast-2"
sourceBucket="aws-captions-deployment-$sourceRegion"

declare -a targetRegions=("us-east-1" "us-west-1" "us-west-2" "eu-west-1" "ap-southeast-1" "ap-south-1")

# Process each target region
for region in "${targetRegions[@]}"
do
   echo "Replicating to: $region"
   
   targetBucket="aws-captions-deployment-$region"

   # aws s3 rm --recursive --profile transcribe "s3://$targetBucket"
   # aws s3 rb --region $region --profile transcribe "s3://$targetBucket" 

   aws s3 mb --region $region --profile transcribe "s3://$targetBucket" 
   # aws s3 rm --recursive --profile transcribe "s3://$targetBucket"
   aws s3 sync "s3://$sourceBucket" "s3://$targetBucket" --acl public-read --profile transcribe

done

