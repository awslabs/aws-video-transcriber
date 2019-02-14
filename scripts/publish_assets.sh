#!/bin/bash

# Publishes assets to ap-southeast-2 for replication

aws s3 rm --recursive --profile transcribe s3://aws-captions-deployment-ap-southeast-2  

cd ../.serverless

aws s3 cp --recursive . s3://aws-captions-deployment-ap-southeast-2/lambda/ --profile transcribe --acl public-read --exclude "*" --include "*.zip"

cd ../cloudformation

aws s3 cp aws-video-transcriber-cloudformation.json s3://aws-captions-deployment-ap-southeast-2/cloudformation/ --profile transcribe --acl public-read

cd ../web

aws s3 cp --recursive . s3://aws-captions-deployment-ap-southeast-2/web/ --profile transcribe --acl public-read --exclude ".DS_Store"

cd ../layers/.serverless

aws s3 cp aws-captions-node-sdk-layer.zip s3://aws-captions-deployment-ap-southeast-2/layers/ --profile transcribe --acl public-read

cd ../../scripts

