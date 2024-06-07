import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { CommonStackProps } from '../models/common'
import { VPCCidr } from '../models/vpc'
import { AwsProvider } from '@cdktf/provider-aws/lib/provider'
import { Vpc } from '@cdktf/provider-aws/lib/vpc'
import { Subnet } from '@cdktf/provider-aws/lib/subnet'
import { RouteTable } from '@cdktf/provider-aws/lib/route-table'
import { InternetGateway } from '@cdktf/provider-aws/lib/internet-gateway'
import { Eip } from '@cdktf/provider-aws/lib/eip'
import { NatGateway } from '@cdktf/provider-aws/lib/nat-gateway'
import { RouteTableAssociation } from '@cdktf/provider-aws/lib/route-table-association'


export const PUBLIC_CIDR = '0.0.0.0/0'

/**
 * Represents the network IDs of a VPC.
 */
export interface VpcNetworkIds {
  /**
   * The ID of the VPC.
   */
  vpcId: string

  /**
   * An array of public subnet IDs within the VPC.
   */
  vpcPublicSubnetIds: string[]

  /**
   * An array of private subnet IDs within the VPC.
   */
  vpcPrivateSubnetIds: string[]
}

/**
 * Represents the properties for a unique VPC network stack.
 */
export interface UniqueVPCNetworkStackProps {
  cidr: VPCCidr
}

/**
 * Represents the properties for the VPCNetworkStack.
 * @interface
 */
export interface VPCNetworkStackProps extends CommonStackProps, UniqueVPCNetworkStackProps {}

/**
 * Represents a VPC network.
 */
export class VpcNetwork extends TerraformStack {
  public readonly vpcId: string;
  public readonly vpcPublicSubnetIds: string[];
  public readonly vpcPrivateSubnetIds: string[];

  /**
   * Constructs a new VpcNetwork.
   * @param app - The CDK app.
   * @param props - The VPC network stack properties.
   */
  constructor(app: Construct, props: VPCNetworkStackProps) {
    super(app, props.id);

    const { credentials, id, cidr } = props;
    const { cidrBlock, publicCIDRs, privateCIDRs } = cidr;

    new AwsProvider(this, 'aws', credentials);

    // Create the VPC
    const vpc = new Vpc(this, id, {
      cidrBlock,
    });

    this.vpcId = vpc.id;

    // Create the subnets
    this.vpcPublicSubnetIds = this.constructSubnets(vpc.id, publicCIDRs, 'public');
    this.vpcPrivateSubnetIds = this.constructSubnets(vpc.id, privateCIDRs, 'private');

    // Create the gateways and routes
    this.constructGatewaysAndRoutes({
      vpcId: this.vpcId,
      vpcPublicSubnetIds: this.vpcPublicSubnetIds,
      vpcPrivateSubnetIds: this.vpcPrivateSubnetIds,
    });
  }

  /**
   * Constructs the subnets for the VPC.
   * @param vpcId - The ID of the VPC.
   * @param cidrs - The CIDR blocks for the subnets.
   * @param type - The type of the subnets (public or private).
   * @returns The IDs of the created subnets.
   */
  private constructSubnets(vpcId: string, cidrs: string[], type: string): string[] {
    const azs = ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'];
    const subnetIds = [];

    for (let i = 0; i < azs.length; i++) {
      const subnet = new Subnet(this, `${vpcId}-${type}-${i}`, {
        vpcId,
        cidrBlock: cidrs[i],
        availabilityZone: azs[i],
        tags: {
          Name: `${vpcId}-${type}-${i}`,
        },
      });

      subnetIds.push(subnet.id);
    }

    return subnetIds;
  }

  /**
   * Constructs the gateways and routes for the VPC.
   * @param vpcNetworkIds - The IDs of the VPC and subnets.
   */
  public constructGatewaysAndRoutes(vpcNetworkIds: VpcNetworkIds): void {
    const { vpcId, vpcPublicSubnetIds, vpcPrivateSubnetIds } = vpcNetworkIds;

    const internetGateway = new InternetGateway(this, 'internet-gateway', {
      vpcId,
    });

    const publicRouteTable = new RouteTable(this, 'public-route-table', {
      vpcId,
      route: [
        {
          cidrBlock: PUBLIC_CIDR,
          gatewayId: internetGateway.id,
        },
      ],
    });

    for (let i = 0; i < vpcPublicSubnetIds.length; i++) {
      const elasticIp = new Eip(this, `eip-${i}`, {
        vpc: true,
      });

      const natGateway = new NatGateway(this, `nat-gateway-${i}`, {
        allocationId: elasticIp.allocationId,
        subnetId: vpcPublicSubnetIds[i],
      });

      new RouteTableAssociation(this, `public-route-table-association-${i}`, {
        routeTableId: publicRouteTable.id,
        subnetId: vpcPublicSubnetIds[i],
      });

      // Private route
      const privateRouteTable = new RouteTable(this, `private-route-table-${i}`, {
        vpcId,
        route: [
          {
            cidrBlock: PUBLIC_CIDR,
            natGatewayId: natGateway.id,
          },
        ],
      });

      // Associate the private route table with the private subnet
      new RouteTableAssociation(this, `private-route-table-association-${i}`, {
        routeTableId: privateRouteTable.id,
        subnetId: vpcPrivateSubnetIds[i],
      });
    }
  }
}
