/**
 * Represents the credentials required for authentication.
 */
export interface Credentials {
  /**
   * The access key for authentication.
   */
  accessKey: string

  /**
   * The secret key for authentication.
   */
  secretKey: string

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
   * The credentials for the stack.
   */
  credentials: Credentials

  /**
   * Optional tags for the stack.
   */
  tags?: Record<string, string>
}
