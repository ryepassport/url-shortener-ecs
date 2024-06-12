# URL Shortener - ECS Example Application

## Disclaimer
This is a work on progress and due to constant cough and flu, I cannot focus well and did not test the code extensively, but I can explain my plan for this application

### Introduction
This application focuses on creating VPC, ECS.
**Initially I intended to create an EKS stack for this but due to piling tasks to achieve it, this needs more time to make**

---
### Features
- Creates VPC
- Creates S3 Backend for tf state
- Creates ECS Application Stack
---

### System Design Goals
- Create a robust application
- Create secure deployment for ECS Application
- Autoscale based on demands

**System Requirements**

- Autoscale based on demands
- Highly available system
- Secure
- Fast response
- Reliable


## Proposed Platform Infrastructure

![AWS Infra](/assets/infra.png)

**Infrastructure**

- Using **AWS** as the cloud provider
    - ELB
    - VPC
    - ECS
    - CloudWatch
    - more

**Technology**
- [**TerraformCDK**](https://developer.hashicorp.com/terraform/cdktf) for Infrastructure as Code
- [**TypeScript**](https://www.typescriptlang.org/) for main language, verbose and expressive
- [**Docker**](https://www.docker.com/) for building images
- [**Python**](https://www.python.org/) to write the API code


## Installation

**This is planned to run in a git workflow pipeline**


**Building ECR Image**

```sh
aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin <account>.dkr.ecr.eu-west-1.amazonaws.com
docker tag url-shortener:latest <account>.dkr.ecr.eu-west-1.amazonaws.com/url-shortener:latest
docker push <account>.dkr.ecr.eu-west-1.amazonaws.com/url-shortener:latest
```

**Build Steps**
*Make sure you have a role or can assume a role that can do all the needed permissions to execute the commands*

**Pre requisite ideally for pipeline**
- node v20*
- cdktf installed
- aws cli installed
- role with the right permissions


```sh
npm run deploy:s3-backend
...
npm run deploy:ecs
```
