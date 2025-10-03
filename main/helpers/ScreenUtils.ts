import { screen, Display } from 'electron';
import { PlatformUtils } from './PlatformUtils';

/**
 * Platform-aware screen dimension utilities
 *
 * macOS: Uses bounds (full screen including menu bar)
 * Windows: Uses workArea (excludes taskbar)
 * Linux: Uses workArea (excludes panels)
 */
export class ScreenUtils {
  /**
   * Get usable screen area for positioning windows
   */
  static getUsableScreenArea(display?: Display): { width: number; height: number; x: number; y: number } {
    const primaryDisplay = display || screen.getPrimaryDisplay();

    // macOS uses bounds, others use workArea
    if (PlatformUtils.isMacOS()) {
      return primaryDisplay.bounds;
    } else {
      return primaryDisplay.workArea;
    }
  }

  /**
   * Get primary display's usable area
   */
  static getPrimaryDisplayArea(): { width: number; height: number; x: number; y: number } {
    return this.getUsableScreenArea();
  }

  /**
   * Get bottom Y position for anchoring character
   */
  static getBottomPosition(windowHeight: number, display?: Display): number {
    const area = this.getUsableScreenArea(display);
    return area.y + area.height - windowHeight;
  }

  /**
   * Get screen width for horizontal positioning
   */
  static getScreenWidth(display?: Display): number {
    return this.getUsableScreenArea(display).width;
  }

  /**
   * Check if position is visible on any display
   */
  static isPositionVisible(x: number, y: number, width: number, height: number): boolean {
    const displays = screen.getAllDisplays();

    for (const display of displays) {
      const area = this.getUsableScreenArea(display);

      if (
        x + width > area.x &&
        x < area.x + area.width &&
        y + height > area.y &&
        y < area.y + area.height
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Log display information for debugging
   */
  static logDisplayInfo(): void {
    const primaryDisplay = screen.getPrimaryDisplay();
    console.log('[ScreenUtils] Display info:', {
      platform: PlatformUtils.getOSType(),
      bounds: primaryDisplay.bounds,
      workArea: primaryDisplay.workArea,
      using: PlatformUtils.isMacOS() ? 'bounds' : 'workArea',
      usableArea: this.getPrimaryDisplayArea()
    });
  }
}
