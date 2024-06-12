import { S3Backend, TerraformStack } from 'cdktf'
import { CommonStackProps } from '../models/common';
import { EksCluster } from '@cdktf/provider-aws/lib/eks-cluster';
import { IamOpenidConnectProvider } from '@cdktf/provider-aws/lib/iam-openid-connect-provider';
import { IamRole } from '@cdktf/provider-aws/lib/iam-role';
import { SecurityGroup } from '@cdktf/provider-aws/lib/security-group';
import { Construct } from 'constructs';
import { AwsProvider } from '@cdktf/provider-aws/lib/provider';
import { PUBLIC_CIDR, VpcNetwork } from './vpc';
import { DataAwsIamPolicyDocument } from '@cdktf/provider-aws/lib/data-aws-iam-policy-document';
import { IamRolePolicyAttachment } from '@cdktf/provider-aws/lib/iam-role-policy-attachment';
import { TlsProvider } from '@cdktf/provider-tls/lib/provider';
import { DataTlsCertificate } from '@cdktf/provider-tls/lib/data-tls-certificate';
import { RandomProvider } from '@cdktf/provider-random/lib/provider';
import { NullProvider } from '@cdktf/provider-null/lib/provider';
import { Resource } from '@cdktf/provider-null/lib/resource';
import { STATE_BUCKET_NAME, STATE_DYNAMO_TABLE_NAME } from '../util/constants';

const EKS_POLICIES = ['AmazonEKSClusterPolicy', 'AmazonEKSServicePolicy']


/**
 * Represents the properties required to create a unique EKS stack.
 */
export interface UniqueEksStackProps {
  vpcNetwork: VpcNetwork
}

/**
 * Represents the properties for the EksStack.
 * @remarks
 * This interface extends UniqueEksStackProps and CommonStackProps.
 */
export interface EksStackProps extends UniqueEksStackProps, CommonStackProps {}

/**
 * Represents the EKS stack.
 */
export class EksStack extends TerraformStack {
  public readonly cluster: EksCluster;
  public readonly oidcProvider: IamOpenidConnectProvider;
  public readonly mainRole: IamRole;
  public readonly mainSecurityGroup: SecurityGroup;

  /**
   * Constructs a new instance of the EksStack class.
   * @param scope The scope of the construct.
   * @param props The properties of the EksStack.
   */
  constructor(scope: Construct, props: EksStackProps) {
    super(scope, props.id);

    const { credentials, vpcNetwork, tags } = props;

    // setting backend for storing the Terraform state
    new S3Backend(this, {
      bucket: STATE_BUCKET_NAME,
      key: 'url-shortener-terraform-state.tfstate',
      encrypt: true,
      dynamodbTable: STATE_DYNAMO_TABLE_NAME,
      profile: credentials.profile,
      region: credentials.region,
    })

    
    const { vpcId, vpcPrivateSubnetIds, vpcPublicSubnetIds } = vpcNetwork;

    new AwsProvider(this, 'aws', credentials);

    const assumeRolePolicy = new DataAwsIamPolicyDocument(this, 'eks-cluster-role-assumeRolePolicy', {
      statement: [
        {
          effect: 'Allow',
          actions: ['sts:AssumeRole'],
          principals: [
            {
              identifiers: ['eks.amazonaws.com'],
              type: 'Service',
            },
          ],
        },
      ],
    });

    this.mainRole = new IamRole(this, 'eks-cluster-main-role', {
      name: 'eks-cluster-main-role',
      assumeRolePolicy: assumeRolePolicy.json,
    });

    for (const policy of EKS_POLICIES) {
      new IamRolePolicyAttachment(this, `eks-cluster-main-role-${policy}`, {
        role: this.mainRole.name,
        policyArn: `arn:aws:iam::aws:policy/${policy}`,
      });
    }

    this.mainSecurityGroup = new SecurityGroup(this, 'eks-main-security-group', {
      name: 'eks-main-security-group',
      vpcId,
      description: 'EKS main security group',
      ingress: [
        {
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

    this.cluster = new EksCluster(this, 'eks-cluster', {
      name: 'url-shortener-eks-cluster',
      version: '1.28',
      roleArn: this.mainRole.arn,
      vpcConfig: {
        subnetIds: [...vpcPublicSubnetIds, ...vpcPrivateSubnetIds],
        securityGroupIds: [this.mainSecurityGroup.id],
      },
      tags: {
        Name: 'url-shortener-eks-cluster',
      },
    });

    // Create the OIDC provider
    new TlsProvider(this, 'tls-provider');
    const issuerUrl = this.cluster.identity.get(0).oidc.get(0).issuer;

    const tlsCert = new DataTlsCertificate(this, 'eks-oidc-issuer', {
      url: issuerUrl,
    });

    this.oidcProvider = new IamOpenidConnectProvider(this, 'eks-oidc-provider', {
      clientIdList: ['sts.amazonaws.com'],
      thumbprintList: [tlsCert.certificates.get(0).sha1Fingerprint],
      url: issuerUrl,
      tags: {
        Name: 'eks-cluster-oidc-provider',
      },
    });

    // wait for cluster to be ready
    new RandomProvider(this, 'random-provider');
    new NullProvider(this, 'null-provider');
    const resource = new Resource(this, 'wait-for-cluster', {
      dependsOn: [this.cluster],
    });

    resource.addOverride('provisioner', [
      {
        localExec: {
          command:
            'for i in `seq 1 60`; do wget --no-check-certificate -O - -q $ENDPOINT/healthz >/dev/null && exit 0 || true; sleep 5; done; echo TIMEOUT && exit 1',
          interpreter: ['/bin/sh', '-c'],
          environment: {
            ENDPOINT: this.cluster.endpoint,
          },
        },
      },
    ]);
  }
}
