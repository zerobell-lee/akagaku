/**
 * Platform detection utilities
 * Provides type-safe platform detection and OS-specific behavior
 */

export type OSType = 'macos' | 'windows' | 'linux' | 'unknown';

export class PlatformUtils {
  /**
   * Get normalized OS type
   */
  static getOSType(): OSType {
    switch (process.platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      case 'linux':
        return 'linux';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if running on macOS
   */
  static isMacOS(): boolean {
    return process.platform === 'darwin';
  }

  /**
   * Check if running on Windows
   */
  static isWindows(): boolean {
    return process.platform === 'win32';
  }

  /**
   * Check if running on Linux
   */
  static isLinux(): boolean {
    return process.platform === 'linux';
  }

  /**
   * Get platform-specific path separator
   */
  static getPathSeparator(): string {
    return this.isWindows() ? '\\' : '/';
  }

  /**
   * Log platform information for debugging
   */
  static logPlatformInfo(): void {
    console.log('[PlatformUtils] Platform info:', {
      platform: process.platform,
      osType: this.getOSType(),
      arch: process.arch,
      nodeVersion: process.version
    });
  }
}
