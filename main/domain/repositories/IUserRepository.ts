/**
 * User Repository Interface
 *
 * Domain layer interface for user data access.
 * Implementation should be in infrastructure layer.
 */
export interface IUserRepository {
  /**
   * Get user settings
   */
  getUserSetting(): any;

  /**
   * Update specific user information
   */
  updateUserInfo(key: string, value: any): Promise<void>;
}