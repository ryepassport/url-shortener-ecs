import { TerraformStack } from 'cdktf'
import { Construct } from 'constructs'
import { CommonStackProps } from '../models/common'
import { AwsProvider } from '@cdktf/provider-aws/lib/provider'
import { S3Bucket } from '@cdktf/provider-aws/lib/s3-bucket'
import { DynamodbTable } from '@cdktf/provider-aws/lib/dynamodb-table'


/**
 * Represents the properties required for the UniqueUrlShortenerTerraformStateBackendStack.
 */
export interface UniqueUrlShortenerTerraformStateBackendStackProps {
  /**
   * The name of the S3 bucket used for storing Terraform state.
   */
  bucketName: string;

  /**
   * The name of the DynamoDB table used for locking Terraform state.
   */
  dynamoTableName: string;
}


/**
 * Represents the properties for the UrlShortenerTerraformStateBackendStack.
 * Inherits from CommonStackProps and UniqueUrlShortenerTerraformStateBackendStackProps.
 */
export interface UrlShortenerTerraformStateBackendStackProps extends CommonStackProps, UniqueUrlShortenerTerraformStateBackendStackProps {}

/**
 * Represents the UrlShortenerTerraformStateBackendStack class.
 * This class extends the TerraformStack class and is responsible for creating the backend infrastructure for the URL shortener application.
 */
export class UrlShortenerTerraformStateBackendStack extends TerraformStack {
  /**
   * Constructs a new instance of the UrlShortenerTerraformStateBackendStack class.
   * @param scope - The scope of the construct.
   * @param props - The properties for the stack.
   */
  constructor(scope: Construct, props: UrlShortenerTerraformStateBackendStackProps) {
    super(scope, props.id)

    new AwsProvider(this, 'aws', props.credentials)

    const { id, bucketName, dynamoTableName } = props
    
    // Create the S3 bucket with versioning enabled
    new S3Bucket(this, id, {
      bucket: bucketName,
      versioning: {
        enabled: true
      }
    })

    // Create the DynamoDB table
    new DynamodbTable(this, `${id}-table`, {
      name: dynamoTableName,
      attribute: [
        {
          name: 'LockID',
          type: 'S'
        }
      ],
      hashKey: 'LockID',
      billingMode: 'PAY_PER_REQUEST',
    })
  }
}
