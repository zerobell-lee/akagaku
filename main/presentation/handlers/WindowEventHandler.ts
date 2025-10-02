import { BrowserWindow, IpcMainEvent, screen } from 'electron';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { ConfigRepository } from '../../infrastructure/config/ConfigRepository';
import { UserActionHandler } from './UserActionHandler';
import { logger } from '../../infrastructure/config/logger';

interface DragState {
  startMouse: { x: number; y: number } | null;
  startWindow: { x: number; y: number } | null;
}

/**
 * WindowEventHandler - Handles all window-related IPC events
 *
 * Manages:
 * - Window dragging (drag-start, move-window, drag-end)
 * - Window position persistence
 * - Off-screen detection and character reactions
 */
export class WindowEventHandler implements IIPCHandler {
  private mainWindow: BrowserWindow;
  private configRepository: ConfigRepository;
  private userActionHandler: UserActionHandler;
  private dragState: DragState = {
    startMouse: null,
    startWindow: null,
  };
  private wasOffScreen: boolean = false;

  constructor(
    mainWindow: BrowserWindow,
    configRepository: ConfigRepository,
    userActionHandler: UserActionHandler
  ) {
    this.mainWindow = mainWindow;
    this.configRepository = configRepository;
    this.userActionHandler = userActionHandler;
  }

  getEventNames(): string[] {
    return ['drag-start', 'move-window', 'drag-end'];
  }

  canHandle(eventName: string): boolean {
    return this.getEventNames().includes(eventName);
  }

  async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
    switch (eventName) {
      case 'drag-start':
        this.handleDragStart();
        break;
      case 'move-window':
        this.handleMoveWindow();
        break;
      case 'drag-end':
        await this.handleDragEnd();
        break;
      default:
        logger.warn(`[WindowEventHandler] Unknown event: ${eventName}`);
    }
  }

  /**
   * Handle drag start - capture initial mouse and window position
   */
  private handleDragStart(): void {
    this.dragState.startMouse = screen.getCursorScreenPoint();
    const [x, y] = this.mainWindow.getPosition();
    this.dragState.startWindow = { x, y };
    logger.debug('[WindowEventHandler] Drag started');
  }

  /**
   * Handle window move - update window position based on mouse movement
   */
  private handleMoveWindow(): void {
    if (!this.dragState.startWindow || !this.dragState.startMouse) {
      return;
    }

    const currentMouse = screen.getCursorScreenPoint();
    const dx = currentMouse.x - this.dragState.startMouse.x;
    const newX = this.dragState.startWindow.x + dx;
    const newY = this.dragState.startWindow.y;

    const bounds = this.mainWindow.getBounds();
    this.mainWindow.setBounds(
      { x: newX, y: newY, width: bounds.width, height: bounds.height },
      false
    );

    // Update speech bubble position via handler
    this.userActionHandler.updateSpeechBubblePosition(newX, newY);
  }

  /**
   * Handle drag end - save position and check for off-screen state
   */
  private async handleDragEnd(): Promise<void> {
    const bounds = this.mainWindow.getBounds();
    const { x, y, width, height } = bounds;

    // Save window position
    this.configRepository.setConfig('windowPosition', { x, y });
    logger.info('[WindowEventHandler] Saved position:', { x, y });

    // Check if character is off-screen (more than 30% hidden)
    const visiblePercentage = this.calculateVisiblePercentage(x, y, width, height);
    logger.debug('[WindowEventHandler] Visible percentage:', visiblePercentage);

    const isOffScreen = visiblePercentage < 70;

    // React to state changes
    if (isOffScreen && !this.wasOffScreen) {
      // Newly hidden
      await this.triggerOffScreenReaction(visiblePercentage);
    } else if (!isOffScreen && this.wasOffScreen) {
      // Restored to visible
      await this.triggerOnScreenReaction(visiblePercentage);
    }

    this.wasOffScreen = isOffScreen;
  }

  /**
   * Calculate what percentage of the window is visible on any display
   */
  private calculateVisiblePercentage(
    x: number,
    y: number,
    width: number,
    height: number
  ): number {
    const displays = screen.getAllDisplays();
    let maxVisibleArea = 0;

    for (const display of displays) {
      const { x: dx, y: dy, width: dw, height: dh } = display.bounds;

      // Calculate visible area
      const visibleX = Math.max(0, Math.min(x + width, dx + dw) - Math.max(x, dx));
      const visibleY = Math.max(0, Math.min(y + height, dy + dh) - Math.max(y, dy));
      const visibleArea = visibleX * visibleY;

      maxVisibleArea = Math.max(maxVisibleArea, visibleArea);
    }

    const totalArea = width * height;
    return (maxVisibleArea / totalArea) * 100;
  }

  /**
   * Trigger character reaction when moved off-screen
   */
  private async triggerOffScreenReaction(visiblePercentage: number): Promise<void> {
    logger.info('[WindowEventHandler] Character is now off-screen, triggering reaction');
    const instruction = `User just dragged you to the edge of the screen. Only ${visiblePercentage.toFixed(
      1
    )}% of your body is visible on screen. You are partially hidden/cut off. React to this situation - complain, express confusion, or ask why they're hiding you. Keep it brief and in character.`;

    await this.userActionHandler.handleUserMessage({
      input: instruction,
      isSystemMessage: true,
    });
  }

  /**
   * Trigger character reaction when brought back on-screen
   */
  private async triggerOnScreenReaction(visiblePercentage: number): Promise<void> {
    logger.info('[WindowEventHandler] Character is now back on screen, triggering reaction');
    const instruction = `User just dragged you back to a visible position. You are now ${visiblePercentage.toFixed(
      1
    )}% visible on screen again. React to being brought back into view - express relief, make a sarcastic comment, or acknowledge the change. Keep it brief and in character.`;

    await this.userActionHandler.handleUserMessage({
      input: instruction,
      isSystemMessage: true,
    });
  }
}
