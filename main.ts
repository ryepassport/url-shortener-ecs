import { Construct } from "constructs";
import { App, TerraformStack } from "cdktf";

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // define resources here
    // create VPC
    // create security group
    // EKS cluster inside VPC
    // create roles
    // create policies
    // create service account
    // create deployment
    // create service
    // create ingress
    // create autoscaling
    // create monitoring
    // create logging
    // create alerting
    // create dashboard
    // create CI/CD pipeline
    // create DNS
    // create SSL
    // create CDN
    // create WAF
    // create firewall
    // create bastion host
    // create VPN
    // create NAT gateway
    // create S3 bucket
    // create RDS
    // create DynamoDB
    // create ElastiCache
    // create ElasticSearch
    // create Kinesis
    // create SQS
    // create SNS
    // create Lambda
    // create Step Functions
    // create API Gateway
    // create Cognito
  }
}

const app = new App();

new MyStack(app, "url-shortener-cdktf");

app.synth();
