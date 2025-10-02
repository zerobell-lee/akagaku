import { IpcMainEvent } from 'electron';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { UserActionHandler } from './UserActionHandler';
import { UserInput } from '@shared/types';
import { logger } from '../../infrastructure/config/logger';

/**
 * MessageHandler - Handles message-related IPC events
 *
 * Manages:
 * - user-message: Direct user messages to character
 * - streaming-complete: Notification when streaming finishes
 */
export class MessageHandler implements IIPCHandler {
  private userActionHandler: UserActionHandler;

  constructor(userActionHandler: UserActionHandler) {
    this.userActionHandler = userActionHandler;
  }

  getEventNames(): string[] {
    return ['user-message', 'streaming-complete'];
  }

  canHandle(eventName: string): boolean {
    return this.getEventNames().includes(eventName);
  }

  async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
    switch (eventName) {
      case 'user-message':
        await this.handleUserMessage(args[0]);
        break;
      case 'streaming-complete':
        this.handleStreamingComplete();
        break;
      default:
        logger.warn(`[MessageHandler] Unknown event: ${eventName}`);
    }
  }

  /**
   * Handle user message
   */
  private async handleUserMessage(message: UserInput): Promise<void> {
    logger.debug('[MessageHandler] Received user message:', message);
    await this.userActionHandler.handleUserMessage(message);
  }

  /**
   * Handle streaming complete notification
   */
  private handleStreamingComplete(): void {
    logger.debug('[MessageHandler] Streaming complete');
    this.userActionHandler.handleStreamingComplete();
  }
}
