import { VPCCidr } from '../models/vpc';

/**
 * The CIDR block for the VPC.
 */
export const VPC_CIDR: VPCCidr = {
  cidr: '192.168.0.0/16',
  publicCIDRs: [
    '192.168.0.0/18',
    '192.168.64.0/18',
  ],
  privateCIDRs: [
    '192.168.128.0/18',
    '192.168.192.0/18'
  ]
}
