import { S3Backend, TerraformOutput, TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { VpcNetwork } from './vpc'
import { CommonStackProps } from '../models/common'
import { STATE_BUCKET_NAME, STATE_DYNAMO_TABLE_NAME } from '../util/constants'
import { AwsProvider } from '@cdktf/provider-aws/lib/provider'
import { EcsClusterStack } from '../constructs/ecs'
import { LoadBalancer } from '../constructs/loadBalancer'
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group'
import { EcrAppImage } from '../constructs/ecrImage'
import path = require('path')
import { NullProvider } from '@cdktf/provider-null/lib/provider'
import { RandomProvider } from '@cdktf/provider-random/lib/provider'

/**
 * Represents the properties required for a unique ECS application.
 */
export interface UniqueEcsApplicationProps {
  vpcNetwork: VpcNetwork
}

/**
 * Represents the properties for an ECS application.
 * Inherits from UniqueEcsApplicationProps and CommonStackProps.
 */
export interface EcsApplicationProps extends UniqueEcsApplicationProps, CommonStackProps {}

/**
 * Represents an ECS application.
 */
export class EcsApplication extends TerraformStack {
  /**
   * Constructs a new instance of the EcsApplication class.
   * @param scope The scope in which to define the application.
   * @param props The properties of the application.
   */
  constructor(scope: Construct, props: EcsApplicationProps) {
    super(scope, props.id)

    const { id, credentials, vpcNetwork, tags } = props

    // set backend for the state
    new S3Backend(this, {
      bucket: STATE_BUCKET_NAME,
      key: 'url-shortener-terraform-state.tfstate',
      encrypt: true,
      dynamodbTable: STATE_DYNAMO_TABLE_NAME,
      ...credentials
    })

    new AwsProvider(this, 'aws', credentials)

    new NullProvider(this, "null", {});
    new RandomProvider(this, "random", {});

    const cluster = new EcsClusterStack(this, {
      vpcNetwork,
      id,
      credentials,
      tags
    })

    const loadBalancer = new LoadBalancer(this, {
      vpc: vpcNetwork,
      id,
      credentials,
      tags,
      cluster: cluster.cluster
    })

    const serviceSecurityGroup = new SecurityGroup(
      this,
      `service-security-group`,
      {
        vpcId: vpcNetwork.vpcId,
        tags,
        ingress: [
          // only allow incoming traffic from our load balancer
          {
            protocol: "TCP",
            fromPort: 80,
            toPort: 80,
            securityGroups: loadBalancer.loadBalancer.securityGroups,
          },
        ],
        egress: [
          // allow all outgoing traffic
          {
            fromPort: 0,
            toPort: 0,
            protocol: "-1",
            cidrBlocks: ["0.0.0.0/0"],
            ipv6CidrBlocks: ["::/0"],
          },
        ],
      }
    );

    const imageResource = new EcrAppImage(this, {
      id,
      credentials,
      tags,
      projectPath: path.resolve(__dirname, '../app')
    })

    const taskDefinition = cluster.deployImage({
      name: `${id}-url-shortener-image`,
      tag: imageResource.tag,
      image: imageResource.image,
      env: {
        ENV_TEST: 'test-value',
        ROLE: 'iam-role-for-application-to-use'
      }
    }, credentials.region)

    loadBalancer.exposeService({
      name: `${id}-url-shortener-service`,
      task: taskDefinition,
      serviceSecurityGroup: serviceSecurityGroup,
      path: '/'
    })
  }
}
