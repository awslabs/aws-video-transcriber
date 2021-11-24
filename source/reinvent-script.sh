#!/usr/bin/env bash
set -e

TRANSLATE_LANGUAGE='zh'
VIDEO_NAME='ENT212_FINAL.mp4'
LANGUAGE='en-US'
INPUT_VIDEO_S3_PATH='s3://reinvent-test-539689806100/source-video/ENT212_FINAL.mp4'
API_KEY='JustAnApiKeyJustAnApiKey'
END_POINT='https://3ee2e7l9df.execute-api.us-east-1.amazonaws.com/prod/'
DEST_KEY_PREFIX='processed'
DEST_BUCKET='reinvent-test-539689806100'
DEST_VIDEO_NAME='ENT212_FINAL'

# call putLanguage API
VIDEOID=$(curl -X PUT -d '{"videoName":"'$VIDEO_NAME'", "language": "'$LANGUAGE'", "inputS3Path": "'$INPUT_VIDEO_S3_PATH'"}' -H "x-api-key: $API_KEY" "$END_POINT"language | jq '.videoId' -r)
echo videoId is: $VIDEOID

# call video post api to start extract process
curl -X POST -d '{"videoId":"'$VIDEOID'", "videoName":"'$VIDEO_NAME'", "inputS3Path": "'$INPUT_VIDEO_S3_PATH'"}' -H "x-api-key: $API_KEY" "$END_POINT"video

# check video status and wait for ready next step
while true; do
    STATUS=$(curl -H "x-api-key: $API_KEY" "$END_POINT"video/$VIDEOID | jq '.video.status' -r)
    if [ "$STATUS" == "READY" ]; then
    echo "video processed successfully!"
    break
    else
    echo "wait for video processing!"
    fi
    sleep 120
done

# call translate api
curl -X PUT -d '{"videoId": "'$VIDEOID'", "targetLanguage": "'$TRANSLATE_LANGUAGE'" }' -H "x-api-key: $API_KEY" "$END_POINT"translate

# check translate status
while true; do
    TRANSLATE_RESULT=$(curl -H "x-api-key: $API_KEY" "$END_POINT"video/$VIDEOID | jq '.video.translatedLanguage' -r)
    if [ "$TRANSLATE_RESULT" == "$TRANSLATE_LANGUAGE" ]; then
        echo "captions translated successfully!"
        break
    else
        echo "wait for captions translating!"
    fi
    sleep 120
done

# # call burn video API
curl -X PUT -d '{"language": "'$TRANSLATE_LANGUAGE'", "translated": "true" }' -H "x-api-key: $API_KEY" "$END_POINT"burn/$VIDEOID

# # check burn status
while true; do
    BURN_VIDEO_RESULT=$(curl -H "x-api-key: $API_KEY" "$END_POINT"video/$VIDEOID | jq '.video.s3BurnedTranslatedVideoPath' -r)
    if [ $BURN_VIDEO_RESULT == null ]; then
        echo "wait for burning captions into video!"
    else
        echo $BURN_VIDEO_RESULT
        echo "burn captions into video successfully!"
        break    
    fi
    sleep 120
done
# a API and Lambda to handle final result
curl -X POST -d '{"videoId": "'$VIDEOID'", "translated": "true", "destKeyPrefix": "'$DEST_KEY_PREFIX'", "destBucket": "'$DEST_BUCKET'", "videoName": "'$DEST_VIDEO_NAME'" }' -H "x-api-key: $API_KEY" "$END_POINT"batchcomplete