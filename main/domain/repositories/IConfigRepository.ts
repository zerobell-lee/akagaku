/**
 * Config Repository Interface
 *
 * Domain layer interface for application configuration management.
 * Implementation should be in infrastructure layer.
 */
export interface IConfigRepository {
  /**
   * Get configuration value by key
   */
  getConfig(key: string): any;

  /**
   * Set configuration value
   */
  setConfig(key: string, value: any): void;
}