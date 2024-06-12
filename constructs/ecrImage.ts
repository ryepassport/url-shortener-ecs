
import { EcrRepository } from '@cdktf/provider-aws/lib/ecr-repository';
import { Construct } from 'constructs'
import { CommonStackProps } from '../models/common';
import { Resource } from "@cdktf/provider-null/lib/resource";
import { DataAwsEcrAuthorizationToken } from '@cdktf/provider-aws/lib/data-aws-ecr-authorization-token';
import { TerraformAsset } from 'cdktf';


export interface UniqueEcrAppImageProps {
  projectPath: string
}

export interface EcrAppImageProps extends UniqueEcrAppImageProps, CommonStackProps {}


export class EcrAppImage extends Construct {
  tag: string;
  image: Resource;
  
  constructor(scope: Construct, props: EcrAppImageProps) {
    super(scope, props.id);

    const { id, tags, projectPath } = props


    const repo = new EcrRepository(this, `ecr`, {
      name: id,
      tags,
    });

    const auth = new DataAwsEcrAuthorizationToken(this, `auth`, {
      dependsOn: [repo],
      registryId: repo.registryId,
    });

    const asset = new TerraformAsset(this, `project`, {
      path: projectPath,
    });

    this.tag = `${repo.repositoryUrl}:latest`;

    // Workaround due to https://github.com/kreuzwerker/terraform-provider-docker/issues/189
    this.image = new Resource(this, `image`, {
      provisioners: [
        {
          type: "local-exec",
          workingDir: asset.path,
          command: `docker login -u ${auth.userName} -p ${auth.password} ${auth.proxyEndpoint} && 
  docker build -t ${this.tag} . && 
  docker push ${this.tag}`,
        },
      ],
    });
  }
}
