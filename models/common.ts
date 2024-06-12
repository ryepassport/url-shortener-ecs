/**
 * Represents the credentials required for authentication.
 */
export interface AWSCredentials {
  /**
   * The access key for authentication.
   */
  accessKey?: string

  /**
   * The secret key for authentication.
   */
  secretKey?: string

  /**
   * 
   */
  profile?: string

  /**
   * The region for authentication.
   */
  region: string
}


/**
 * Represents the common properties for a stack.
 */
export interface CommonStackProps {
  /**
   * The ID of the stack.
   */
  id: string

  /**
   * The locally installed profile for the stack.
   */
  credentials: AWSCredentials

  /**
   * Optional tags for the stack.
   */
  tags?: Record<string, string>
}
