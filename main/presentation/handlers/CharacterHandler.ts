import { IpcMainEvent } from 'electron';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { UserActionHandler } from './UserActionHandler';
import { logger } from '../../infrastructure/config/logger';

/**
 * CharacterHandler - Handles character-related IPC events
 *
 * Manages:
 * - change-skin: Change character skin/outfit
 */
export class CharacterHandler implements IIPCHandler {
  private userActionHandler: UserActionHandler;

  constructor(userActionHandler: UserActionHandler) {
    this.userActionHandler = userActionHandler;
  }

  getEventNames(): string[] {
    return ['change-skin'];
  }

  canHandle(eventName: string): boolean {
    return this.getEventNames().includes(eventName);
  }

  async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
    switch (eventName) {
      case 'change-skin':
        await this.handleChangeSkin(args[0]);
        break;
      default:
        logger.warn(`[CharacterHandler] Unknown event: ${eventName}`);
    }
  }

  /**
   * Handle skin change request
   */
  private async handleChangeSkin(skinId: string): Promise<void> {
    logger.debug('[CharacterHandler] Changing skin to:', skinId);
    await this.userActionHandler.handleChangeSkin(skinId);
  }
}
