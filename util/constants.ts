import { VPCCidr } from '../models/vpc';

/**
 * The CIDR block for the VPC.
 */
export const VPC_CIDR: VPCCidr = {
  cidrBlock: '10.0.0.0/16',
  publicCIDRs: [
    '10.0.96.0/19',
    '10.0.128.0/19',
    '10.0.160.0/19'
  ],
  privateCIDRs: [
    '10.0.0.0/19',
    '10.0.32.0/19',
    '10.0.64.0/19',
  ]
}


export const STATE_BUCKET_NAME = 'url-shortener-terraform-state-rye-pasaporte'
export const STATE_DYNAMO_TABLE_NAME = 'url-shortener-terraform-state-lock'
