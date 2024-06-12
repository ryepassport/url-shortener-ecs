import { App } from 'cdktf'
import { AWSCredentials } from './models/common'
// import { VpcNetwork } from './constructs/vpc'
import { UrlShortenerTerraformStateBackendStack } from './stacks/backend'
import { VpcNetwork } from './stacks/vpc'
import { STATE_BUCKET_NAME, STATE_DYNAMO_TABLE_NAME, VPC_CIDR } from './util/constants'
import { EcsApplication } from './stacks/ecs'

const credentials: AWSCredentials = {
  profile: 'rye-personal',
  region: 'eu-west-1'
}

const app = new App()

// S3 backend
new UrlShortenerTerraformStateBackendStack(app, {
  credentials,
  id: 'url-shortener-terraform-state-backend',
  bucketName: STATE_BUCKET_NAME,
  dynamoTableName: STATE_DYNAMO_TABLE_NAME
})


// VPC
const vpc = new VpcNetwork(app, {
  credentials,
  id: 'url-shortener-vpc',
  cidr: VPC_CIDR,
  tags: {
    name: 'url-shortener-vpc',
    costCenter: 'cost-tag-example-vpc',
    project: 'url-shortener',
    service: 'url-shortener-vpc',
    owner: 'profile-name'
  }
})

// ECS application
const ecsStack = new EcsApplication(app, {
  credentials,
  id: 'url-shortener-ecs',
  vpcNetwork: vpc,
  tags:{
    Name: 'url-shortener-ecs',
    costCenter: 'url-shortener-ecs-cost-center-tag',
    project: 'url-shortener',
    service: 'url-shortener-service',
    owner: credentials.profile as string
  }
})

ecsStack.addDependency(vpc)


// const eksStack = new EksStack(app, {
//   credentials,
//   id: 'url-shortener-eks',
//   vpcNetwork: vpc,
//   tags: {
//     name: 'url-shortener-eks',
//     costCenter: 'cost-tag-example-eks',
//     project: 'url-shortener',
//     service: 'url-shortener-eks',
//     owner: 'profile-name'
//   }
// })

// eksStack.addDependency(vpc)

app.synth()
