要卸载视频字幕解决方案，请删除CloudFormation堆栈。这将删除部署模板时生成的所有资源。

!!! warning "重要提示"

    卸载视频字幕解决方案会将已经上传的视频及相关数据删除。如有需要，请提前备份。

您可以使用亚马逊云科技管理控制台或命令行界面（CLI）删除CloudFormation堆栈。

## 使用亚马逊云科技管理控制台删除堆栈

1. 登录亚马逊云科技管理控制台，选择CloudFormation服务。
1. 选择部署该方案的堆栈。
1. 删除该堆栈。

## 使用CLI删除堆栈

1. 确定命令行在您的环境中是否可用。有关安装说明，请参阅CLI用户指南中的[CLI是什么][aws-cli]。
1. 确认CLI可用后，运行以下命令：

```bash
aws cloudformation delete-stack --stack-name <installation-stack-name> --region <aws-region>
```
[aws-cli]: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html
