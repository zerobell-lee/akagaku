import { BrowserWindow, IpcMainEvent } from 'electron';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { chatHistoryRepository } from '../../infrastructure/chat/ChatHistoryRepository';
import { logger } from '../../infrastructure/config/logger';

/**
 * ArchiveHandler - Handles chat archive-related IPC events
 *
 * Manages:
 * - load-archive: Load archived chat history
 */
export class ArchiveHandler implements IIPCHandler {
  private logsWindow: BrowserWindow | null = null;

  setLogsWindow(window: BrowserWindow | null): void {
    this.logsWindow = window;
  }

  getEventNames(): string[] {
    return ['load-archive'];
  }

  canHandle(eventName: string): boolean {
    return this.getEventNames().includes(eventName);
  }

  async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
    switch (eventName) {
      case 'load-archive':
        this.handleLoadArchive(args[0]);
        break;
      default:
        logger.warn(`[ArchiveHandler] Unknown event: ${eventName}`);
    }
  }

  /**
   * Handle load archive request
   */
  private handleLoadArchive(archiveKey: string): void {
    logger.debug('[ArchiveHandler] Loading archive:', archiveKey);

    const archiveMessages = chatHistoryRepository.getArchive(archiveKey);

    if (this.logsWindow && !this.logsWindow.isDestroyed()) {
      this.logsWindow.webContents.send('archive-loaded', archiveMessages);
    } else {
      logger.warn('[ArchiveHandler] Logs window not available');
    }
  }
}
