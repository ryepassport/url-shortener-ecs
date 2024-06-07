import { App } from 'cdktf'
import { Credentials } from '../models/common'
import { VpcNetwork, VPCNetworkStackProps } from '../constructs/vpc'

const credentials: Credentials = {
  accessKey: process.env.AWS_ACCESS_KEY_ID as string,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  region: process.env.AWS_DEFAULT_REGION as string
}

const app = new App()

const vpcProps: VPCNetworkStackProps = {
  credentials,
  id: 'url-shortener-vpc',
  cidr: {
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
  },
  tags: {
    name: 'url-shortener-vpc',
    costCenter: 'cost-tag-example-vpc',
    project: 'url-shortener-vpc',
    service: 'url-shortener-vpc',
    owner: 'profile-name'
  }
}

const vpcNetwork = new VpcNetwork(app, vpcProps)
