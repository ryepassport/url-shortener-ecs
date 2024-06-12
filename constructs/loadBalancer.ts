import { Lb } from '@cdktf/provider-aws/lib/lb'
import { LbListener } from '@cdktf/provider-aws/lib/lb-listener'
import { Construct } from 'constructs'
import { VpcNetwork } from '../stacks/vpc'
import { EcsCluster } from '@cdktf/provider-aws/lib/ecs-cluster'
import { CommonStackProps } from '../models/common'
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group'
import { EcsTaskDefinition } from '@cdktf/provider-aws/lib/ecs-task-definition'
import { LbTargetGroup } from '@cdktf/provider-aws/lib/lb-target-group'
import { LbListenerRule } from '@cdktf/provider-aws/lib/lb-listener-rule'
import { EcsService } from '@cdktf/provider-aws/lib/ecs-service'

/**
 * Represents the parameters for exposing a service.
 */
export interface ExposeServiceParams {
  /**
   * The name of the service.
   */
  name: string;

  /**
   * The task definition for the service.
   */
  task: EcsTaskDefinition;

  /**
   * The security group for the service.
   */
  serviceSecurityGroup: SecurityGroup;

  /**
   * The path for the service.
   */
  path: string;

  /**
   * Optional tags for the service.
   */
  tags?: { [key: string]: string };
}

/**
 * Represents the properties required to create a unique load balancer.
 */
export interface UniqueLoadBalancerProps {
  vpc: VpcNetwork
  cluster: EcsCluster
}


/**
 * Represents the properties for a LoadBalancer.
 */
export interface LoadBalancerProps extends UniqueLoadBalancerProps, CommonStackProps {}

/**
 * Represents a load balancer construct.
 */
export class LoadBalancer extends Construct {

  public readonly loadBalancer: Lb
  public readonly listener: LbListener

  vpc: VpcNetwork
  cluster: EcsCluster

  constructor(scope: Construct, props: LoadBalancerProps) {
    super(scope, props.id)


    const { cluster, vpc, id, tags  } = props

    this.vpc = vpc
    this.cluster = cluster

    const loadBalancerSecurityGroup = new SecurityGroup(this, `${id}-load-balancer-sg`, {
      vpcId: this.vpc.vpcId,
      tags,
      ingress: [
        // allow HTTP traffic from everywhere
        {
          protocol: "TCP",
          fromPort: 80,
          toPort: 80,
          cidrBlocks: ["0.0.0.0/0"],
          ipv6CidrBlocks: ["::/0"],
        },
      ],
      egress: [
        // allow all traffic to every destination
        {
          fromPort: 0,
          toPort: 0,
          protocol: "-1",
          cidrBlocks: ["0.0.0.0/0"],
          ipv6CidrBlocks: ["::/0"],
        },
      ],
    })


    // const lbAccessLogsBucket = new S3Bucket(this, `${id}-lb-access-logs-bucket`, {
    //   n: 'my-access-logs-bucket',
    //   tags,
    // });


    this.loadBalancer = new Lb(this, `${id}-load-balancer`, {
      name: id,
      tags,
      internal: false,
      loadBalancerType: 'application',
      securityGroups: [loadBalancerSecurityGroup.id],
      subnets: this.vpc.vpcPublicSubnetIds,
      accessLogs: {
        enabled: true,
        bucket: "my-access-logs-bucket" // make a bucket for the access logs
      }
    })

    this.listener = new LbListener(this, `${id}-lb-listener`, {
      loadBalancerArn: this.loadBalancer.arn,
      port: 80,
      protocol: 'HTTP',
      tags,
      defaultAction: [
        // Define a fixed 404 message for incorrect path
        {
          type: "fixed-response",
          fixedResponse: {
            contentType: "text/plain",
            statusCode: "404",
            messageBody: "Could not find the resource you are looking for",
          },
        },
      ]
    })

  }

  public exposeService(params: ExposeServiceParams) {
    const { name, task, serviceSecurityGroup, path, tags } = params


    // health check
    const targetGroup = new LbTargetGroup(this, `${name}target-group`, {
      dependsOn: [this.loadBalancer],
      tags,
      name: `${name}-target-group`,
      port: 80,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: this.vpc.vpcId,
      healthCheck: {
        enabled: true,
        path: "/ready",
      },
    });

    new LbListenerRule(this, `${name}-lb-listener-rule`, {
      listenerArn: this.listener.arn,
      priority: 100,
      tags,
      action: [
        {
          type: 'forward',
          targetGroupArn: targetGroup.arn,
        }
      ],
      condition: [
        {
          pathPattern: {
            values: [`${path}*`]
          },
        },
      ],
    })


    new EcsService(this, `${name}-ecs-service`, {
      dependsOn: [this.listener],
      tags,
      name,
      launchType: 'FARGATE',
      cluster: this.cluster.id,
      desiredCount: 1,
      taskDefinition: task.arn,
      networkConfiguration: {
        subnets: this.vpc.vpcPublicSubnetIds,
        assignPublicIp: true,
        securityGroups: [serviceSecurityGroup.id]
      },
      loadBalancer: [
        {
          containerPort: 80,
          containerName: name,
          targetGroupArn: targetGroup.arn
        }
      ]
    })
  }
}
