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
  private lastMessageHash = '';
  private lastMessageTime = 0;
  private readonly DEBOUNCE_MS = 300; // 300ms debounce window

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
    // Create hash from message content
    const messageHash = `${message.input}-${message.isSystemMessage}`;
    const now = Date.now();

    // Ignore duplicate messages within debounce window
    if (messageHash === this.lastMessageHash && (now - this.lastMessageTime) < this.DEBOUNCE_MS) {
      console.log('[IPC] Duplicate message ignored (debounce):', message.input.substring(0, 50));
      return;
    }

    // Ignore if already processing a message
    if (this.userActionHandler.getGhostIsProcessingMessage()) {
      console.log('[IPC] Message ignored (already processing):', message.input.substring(0, 50));
      return;
    }

    this.lastMessageHash = messageHash;
    this.lastMessageTime = now;

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
