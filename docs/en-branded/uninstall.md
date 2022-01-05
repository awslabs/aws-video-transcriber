To uninstall the Video Transcriber solution, you must delete the Amazon CloudFormation stack. 

!!! warning "Important"
  
    The uploaded videos and related data will be removed when you uninstall the Video Transcriber solution. Make sure to back up what you need beforehand.

You can use either the Amazon Web Services Management Console or the Amazon Web Services Command Line Interface (CLI) to delete the CloudFormation stack.

## Uninstall the stack using the Amazon Management Console

1. Sign in to the [Amazon CloudFormation][cloudformation-console] console.
1. Select this solution’s installation parent stack.
1. Choose **Delete**.

## Uninstall the stack using Amazon Web Services Command Line Interface

1. Determine whether the CLI is available in your environment. For installation instructions, refer to [What Is the Amazon Web Services Command Line Interface][aws-cli] in the *Amazon Web Services CLI User Guide*.
1. After confirming that the CLI is available, run the following command:

```bash
aws cloudformation delete-stack --stack-name <installation-stack-name> --region <aws-region>
```
[cloudformation-console]: https://console.aws.amazon.com/cloudformation/home
[aws-cli]: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-welcome.html
