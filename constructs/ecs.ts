import { S3Backend } from 'cdktf'
import { CommonStackProps } from '../models/common'
import { PUBLIC_CIDR, VpcNetwork } from '../stacks/vpc'
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster'
import { IamRole } from '@cdktf/provider-aws/lib/iam-role'
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group'
import { Construct } from 'constructs'
import { EcsClusterCapacityProviders } from '@cdktf/provider-aws/lib/ecs-cluster-capacity-providers'
import { LaunchConfiguration } from '@cdktf/provider-aws/lib/launch-configuration'
import { AwsProvider } from '@cdktf/provider-aws/lib/provider'
import { STATE_BUCKET_NAME, STATE_DYNAMO_TABLE_NAME } from '../util/constants'
import { AutoscalingGroup } from '@cdktf/provider-aws/lib/autoscaling-group'
import { EcsCapacityProvider } from '@cdktf/provider-aws/lib/ecs-capacity-provider'
import { Resource } from '@cdktf/provider-null/lib/resource'
import { CloudwatchLogGroup } from '@cdktf/provider-aws/lib/cloudwatch-log-group'
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition'


/**
 * Represents the parameters for an ECR image.
 */
interface EcrImageParams {
  name: string
  tag: string
  image: Resource
  env: Record<string, string | undefined>
}

/**
 * Represents the properties for a unique ECS cluster.
 */
export interface UniqueEcsClusterProps {
  vpcNetwork: VpcNetwork
}

/**
 * Represents the properties for the EcsClusterStack.
 * @interface
 * @extends UniqueEcsClusterProps
 * @extends CommonStackProps
 */
export interface EcsClusterStackProps extends UniqueEcsClusterProps, CommonStackProps {}

/**
 * Represents an ECS Cluster Stack.
 */
export class EcsClusterStack extends Construct {
  public readonly cluster: EcsCluster;

  /**
   * Constructs a new EcsClusterStack.
   * @param scope The parent construct scope.
   * @param props The construct properties.
   */
  constructor(scope: Construct, props: EcsClusterStackProps) {
    super(scope, props.id);

    const { id, vpcNetwork, tags, credentials } = props;
    const { vpcId } = vpcNetwork;

    // setting backend for storing the Terraform state
    new S3Backend(this, {
      bucket: STATE_BUCKET_NAME,
      key: 'url-shortener-terraform-state.tfstate',
      encrypt: true,
      dynamodbTable: STATE_DYNAMO_TABLE_NAME,
      ...credentials,
    });

    new AwsProvider(this, 'aws', credentials);

    const securityGroup = new SecurityGroup(this, `${id}-ecs-instance-sg`, {
      name: `${id}-ecs-instance-sg`,
      vpcId: vpcId,
      ingress: [
        {
          description: 'Allow all inbound traffic',
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          selfAttribute: true,
        },
      ],
      egress: [
        {
          fromPort: 0,
          toPort: 0,
          protocol: '-1',
          cidrBlocks: [PUBLIC_CIDR],
        },
      ],
      tags,
      lifecycle: {
        ignoreChanges: ['ingress', 'egress'],
      },
    });

    const launchConfiguration = new LaunchConfiguration(this, `${id}-ecs-launch-config`, {
      imageId: 'ami-0aa204fea41b74213',
      instanceType: 't2.micro',
      securityGroups: [securityGroup.id],
    });

    const cluster = new EcsCluster(this, `${id}-ecs-cluster`, {
      name: `${id}-ecs-cluster`,
      tags,
    });

    const autoScalingGroup = new AutoscalingGroup(this, `${id}-ecs-ec2-asg`, {
      launchConfiguration: launchConfiguration.id,
      desiredCapacity: 1,
      maxSize: 1,
      minSize: 1,
      vpcZoneIdentifier: vpcNetwork.vpcPrivateSubnetIds,
    });

    const capacityProvider = new EcsCapacityProvider(this, `${id}-ecs-capacity-provider`, {
      name: `${id}-ecs-capacity-provider`,
      autoScalingGroupProvider: {
        autoScalingGroupArn: autoScalingGroup.arn,
        managedScaling: {
          status: 'ENABLED',
        },
        managedTerminationProtection: 'ENABLED',
      },
    });

    new EcsClusterCapacityProviders(this, 'test', {
      clusterName: cluster.name,
      capacityProviders: [capacityProvider.name],
    });

    this.cluster = cluster;
  }

  /**
   * Deploys an image to the ECS cluster.
   * @param params The ECR image parameters.
   * @param region The AWS region.
   * @param tags Optional tags for the ECS task definition.
   * @returns The ECS task definition.
   */
  public deployImage(params: EcrImageParams, region: string, tags?: { [key: string]: string }): EcsTaskDefinition {
    const { name, image, tag, env } = params;

    const executionRole = new IamRole(this, `${name}-execution-role`, {
      name: `${name}-execution-role`,
      tags,
      inlinePolicy: [
        {
          name: 'allow-ecr-pull',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: [
                  'ecr:GetAuthorizationToken',
                  'ecr:BatchCheckLayerAvailability',
                  'ecr:GetDownloadUrlForLayer',
                  'ecr:BatchGetImage',
                  'logs:CreateLogStream',
                  'logs:PutLogEvents',
                ],
                Resource: '*',
              },
            ],
          }),
        },
      ],
      // this role shall only be used by an ECS task
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      }),
    });

    // Role that allows us to push logs
    const taskRole = new IamRole(this, `${name}-task-role`, {
      name: `${name}-task-role`,
      tags,
      inlinePolicy: [
        {
          name: 'allow-logging',
          policy: JSON.stringify({
            Version: '2012-10-17',
            Statement: [
              {
                Effect: 'Allow',
                Action: ['logs:CreateLogStream', 'logs:PutLogEvents'],
                Resource: '*',
              },
            ],
          }),
        },
      ],
      assumeRolePolicy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Sid: '',
            Principal: {
              Service: 'ecs-tasks.amazonaws.com',
            },
          },
        ],
      }),
    });

    const logGroup = new CloudwatchLogGroup(this, `${name}-ecr-log-group`, {
      name: `${this.cluster.name}/${name}`,
      retentionInDays: 30,
      tags,
    });

    const taskDefinition = new EcsTaskDefinition(this, `${name}-task-definition`, {
      dependsOn: [image],
      tags,
      cpu: '256',
      memory: '512',
      requiresCompatibilities: ['FARGATE', 'EC2'],
      networkMode: 'awsvpc',
      executionRoleArn: executionRole.arn,
      taskRoleArn: taskRole.arn,
      containerDefinitions: JSON.stringify([
        {
          name,
          image: tag,
          cpu: 256,
          memory: 512,
          environment: Object.entries(env).map(([name, value]) => ({
            name,
            value,
          })),
          portMappings: [
            {
              containerPort: 8080,
              hostPort: 80,
            },
          ],
          logConfiguration: {
            logDriver: 'awslogs',
            options: {
              'awslogs-group': logGroup.name,
              'awslogs-region': region,
              'awslogs-stream-prefix': name,
            },
          },
        },
      ]),
      family: 'service',
    });

    return taskDefinition;
  }
}
