import { App } from 'cdktf'
import { Credentials } from '../models/common'
import { VpcNetwork } from '../constructs/vpc'
import { EksStack } from '../constructs/eks'

const credentials: Credentials = {
  accessKey: process.env.AWS_ACCESS_KEY_ID as string,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  region: 'eu-west-1'
}

const app = new App()

const vpcNetwork = new VpcNetwork(app, {
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
    project: 'url-shortener',
    service: 'url-shortener-vpc',
    owner: 'profile-name'
  }
})

const eksStack = new EksStack(app, {
  credentials,
  id: 'url-shortener-eks',
  vpcNetwork,
  tags: {
    name: 'url-shortener-eks',
    costCenter: 'cost-tag-example-eks',
    project: 'url-shortener',
    service: 'url-shortener-eks',
    owner: 'profile-name'
  }
})

eksStack.addDependency(vpcNetwork)

app.synth()
