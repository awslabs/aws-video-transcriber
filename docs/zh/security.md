当您在亚马逊云科技基础设施上构建解决方案时，安全责任由您和亚马逊云科技共同承担。此[共享模型](https://aws.amazon.com/compliance/shared-responsibility-model/)减少了您的操作负担，这是由于亚马逊云科技操作、管理和控制组件，包括主机操作系统、虚拟化层以及服务运行所在设施的物理安全性。有关亚马逊云科技安全的更多信息，请访问亚马逊云科技[云安全](http://aws.amazon.com/security/)。

## IAM角色

亚马逊云科技身份和访问管理（IAM）角色允许客户为亚马逊云科技上的服务和用户分配细粒度访问策略和权限。此解决方案创建了一些IAM角色，这些角色授予解决方案各组件间的访问权限。

## MediaConvert 策略

此解决方案中创建的MediaConvert 策略允许Amazon Elemental Mediaconvert 访问S3存储桶。

## Lambda 策略

此解决方案中创建的Lambda 策略允许Amazon Lambda Functions访问Amazon DynamoDB, Amazon Elemental Mediaconvert, Amazon Transcribe 和Amazon Translate 服务。