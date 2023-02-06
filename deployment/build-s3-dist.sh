#!/bin/bash 
# 
# This assumes all of the OS-level configuration has been completed and git repo has already been cloned 
# 
# This script should be run from the repo's deployment directory 
# cd deployment 
# ./build-s3-dist.sh source-bucket-base-name trademarked-solution-name version-code 
# 
# Paramenters: 
#  - source-bucket-base-name: Name for the S3 bucket location where the template will source the Lambda 
#    code from. The template will append '-[region_name]' to this bucket name. 
#    For example: ./build-s3-dist.sh solutions my-solution v1.0.0 cf-template-bucket
#    The template will then expect the source code to be located in the solutions-[region_name] bucket 
# 
#  - trademarked-solution-name: name of the solution for consistency 
# 
#  - version-code: version of the package 
 
# Check to see if input has been provided:

sedi()
{
    # cross-platform for sed -i
    sed -i $* 2>/dev/null || sed -i "" $*
}

[ "$DEBUG" == 'true' ] && set -x
set -x
set -e

if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Parameters not enough"
    echo "Example: $(basename $0) <BUCKET_NAME> <SOLUTION_NAME> [VERSION]"
    exit 1
fi

export BUCKET_NAME=$1
export SOLUTION_NAME=$2
if [ -z "$3" ]; then
    # export VERSION="v$(jq -r '.version' ${SRC_PATH}/version.json)"
    export VERSION=$(git describe --tags || echo latest)
else
    export VERSION=$3
fi
 
# Get reference for all important folders 
template_dir="$PWD" 
template_dist_dir="$template_dir/global-s3-assets" 
build_dist_dir="$template_dir/regional-s3-assets" 
source_dir="$template_dir/../source" 

echo "------------------------------------------------------------------------------" 
echo "[Init] Clean old dist, node_modules and bower_components folders" 
echo "------------------------------------------------------------------------------" 
echo "rm -rf $template_dist_dir" 
rm -rf $template_dist_dir 
echo "mkdir -p $template_dist_dir" 
mkdir -p $template_dist_dir 
echo "rm -rf $build_dist_dir" 
rm -rf $build_dist_dir 
echo "mkdir -p $build_dist_dir" 
mkdir -p $build_dist_dir 

echo "BUCKET_NAME=${BUCKET_NAME}"
echo "SOLUTION_NAME=${SOLUTION_NAME}"
echo "VERSION=${VERSION}"
echo "${VERSION}" > ${template_dist_dir}/version

echo "------------------------------------------------------------------------------"
echo "[Packing] Templates"
echo "------------------------------------------------------------------------------"
for file in $template_dir/*.template
do
    echo "cp $file $template_dist_dir/"
    cp $file $template_dist_dir/
done

echo "------------------------------------------------------------------------------"
echo "[Updating Source Bucket name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%BUCKET_NAME%%/$BUCKET_NAME/g"
for file in $template_dist_dir/*.template
do
    echo "sedi $replace $file" 
    sedi $replace $file
done

echo "------------------------------------------------------------------------------" 
echo "[Updating Template Bucket name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%TEMPLATE_BUCKET_NAME%%/$BUCKET_NAME/g"
for file in $template_dist_dir/*.template
do
    echo "sedi $replace $file"
    sedi $replace $file
done

echo "------------------------------------------------------------------------------" 
echo "[Updating Solution name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%SOLUTION_NAME%%/$SOLUTION_NAME/g"
for file in $template_dist_dir/*.template
do
    echo "sedi $replace $file"
    sedi $replace $file
done

echo "------------------------------------------------------------------------------" 
echo "[Updating version name]"
echo "------------------------------------------------------------------------------" 
replace="s/%%VERSION%%/$VERSION/g"
for file in $template_dist_dir/*.template
do
    echo "sedi $replace $file"
    sedi $replace $file
done

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Web UI"
echo "------------------------------------------------------------------------------"

mkdir -p $build_dist_dir/web

echo "------------------------------------------------------------------------------"
echo "[Rebuild] extractaudio"
echo "------------------------------------------------------------------------------"
cd $source_dir/web
echo $PWD
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
ls
cp -f node_modules/axios/dist/axios.min.js js/
cp -f node_modules/bootstrap/dist/js/bootstrap.min.js js/
cp -f node_modules/datatables.net-bs4/js/dataTables.bootstrap4.min.js js/
cp -f node_modules/dropzone/dist/min/dropzone.min.js js/
cp -f node_modules/file-saver/dist/FileSaver.min.js js/
cp -f node_modules/handlebars/dist/handlebars.min.js js/
cp -f node_modules/jquery/dist/jquery.min.js js/
cp -f node_modules/datatables.net/js/jquery.dataTables.min.js js/
cp -f node_modules/vanilla-router/dist/vanilla-router.js js/
cp -R $source_dir/web/* $build_dist_dir/web
rm -f js/axios.min.js
rm -f js/bootstrap.min.js
rm -f js/dataTables.bootstrap4.min.js
rm -f js/dropzone.min.js
rm -f js/FileSaver.min.js
rm -f js/handlebars.min.js
rm -f js/jquery.min.js
rm -f js/jquery.dataTables.min.js
rm -f js/vanilla-router.js

echo "------------------------------------------------------------------------------"
echo "[Rebuild] Lambda function"
echo "------------------------------------------------------------------------------"

# echo $source_dir
mkdir -p $build_dist_dir/lambda

echo "------------------------------------------------------------------------------"
echo "[Rebuild] extractaudio"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/extractaudio
echo $PWD
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
zip -q -r9 $build_dist_dir/lambda/ExtractAudio.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] putlanguage"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/putlanguage
echo $PWD
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
zip -q -r9 $build_dist_dir/lambda/PutLanguage.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] transcribeaudio"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/transcribeaudio
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
zip -q -r9 $build_dist_dir/lambda/TranscribeAudio.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] translatecaptions"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/translatecaptions
zip -q -r9 $build_dist_dir/lambda/TranslateCaptions.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] batchcomplete"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/batchcomplete
zip -q -r9 $build_dist_dir/lambda/BatchComplete.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] createcaptions"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/createcaptions
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
zip -q -r9 $build_dist_dir/lambda/CreateCaptions.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] bootstrap"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/bootstrap
zip -q -r9 $build_dist_dir/lambda/BootStrap.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] burncaption"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/burncaption
zip -q -r9 $build_dist_dir/lambda/BurnCaption.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] customresource"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/customresource
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
zip -q -r9 $build_dist_dir/lambda/CustomResource.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] deletevideo"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/deletevideo
zip -q -r9 $build_dist_dir/lambda/DeleteVideo.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] getcaption"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/getcaption
zip -q -r9 $build_dist_dir/lambda/GetCaption.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] gettweaks"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/gettweaks
zip -q -r9 $build_dist_dir/lambda/GetTweaks.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] getupload"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/getupload
zip -q -r9 $build_dist_dir/lambda/GetUpload.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] getvideo"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/getvideo
zip -q -r9 $build_dist_dir/lambda/GetVideo.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] getvideos"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/getvideos
zip -q -r9 $build_dist_dir/lambda/GetVideos.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] getvocabulary"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/getvocabulary
zip -q -r9 $build_dist_dir/lambda/GetVocabulary.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] headvocabulary"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/headvocabulary
zip -q -r9 $build_dist_dir/lambda/HeadVocabulary.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] putcaption"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/putcaption
zip -q -r9 $build_dist_dir/lambda/PutCaption.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] puttweaks"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/puttweaks
zip -q -r9 $build_dist_dir/lambda/PutTweaks.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] putvocabulary"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/putvocabulary
zip -q -r9 $build_dist_dir/lambda/PutVocabulary.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] reprocessvideo"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/reprocessvideo
npm install --production --legacy-peer-deps
build_status=$? 
if [ ${build_status} != '0' ]; then 
    echo "Error occurred in building Helper. Error Code: ${build_status}" 
    exit ${build_status} 
fi
zip -q -r9 $build_dist_dir/lambda/ReprocessVideo.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] updatevideodescription"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/updatevideodescription
zip -q -r9 $build_dist_dir/lambda/UpdateVideoDescription.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] updatevideolanguage"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/updatevideolanguage
zip -q -r9 $build_dist_dir/lambda/UpdateVideoLanguage.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] updatevideoname"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/updatevideoname
zip -q -r9 $build_dist_dir/lambda/UpdateVideoName.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] updatevideostatus"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/updatevideostatus
zip -q -r9 $build_dist_dir/lambda/UpdateVideoStatus.zip *

echo "------------------------------------------------------------------------------"
echo "[Rebuild] getburnedvideo"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/getburnedvideo
zip -q -r9 $build_dist_dir/lambda/GetBurnedVideo.zip * 

echo "------------------------------------------------------------------------------"
echo "[Rebuild] updateburnedvideopath"
echo "------------------------------------------------------------------------------"
cd $source_dir/lambda/updateburnedvideopath
zip -q -r9 $build_dist_dir/lambda/UpdateBurnedVideoPath.zip *

# aws s3 cp $build_dist_dir/* 







