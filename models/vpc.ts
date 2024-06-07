/**
 * Represents the configuration for a VPC CIDR block.
 */
export interface VPCCidr {
  /**
   * The CIDR block for the VPC.
   */
  cidrBlock: string
  /**
   * The CIDR blocks for the public subnets.
   */
  publicCIDRs: string[]
  /**
   * The CIDR blocks for the private subnets.
   */
  privateCIDRs: string[]
}
