import { IpcMainEvent, IpcMainInvokeEvent } from 'electron';

/**
 * IIPCHandler - Base interface for all IPC event handlers
 *
 * All IPC communication must go through handlers implementing this interface.
 * This ensures:
 * - Consistent event handling patterns
 * - Testability through dependency injection
 * - Clear separation of concerns
 * - Prevention of direct ipcMain usage in background.ts
 */
export interface IIPCHandler {
  /**
   * Get the list of IPC event names this handler manages
   * Used by IPCRegistry to register events
   */
  getEventNames(): string[];

  /**
   * Check if this handler can handle a specific event
   */
  canHandle(eventName: string): boolean;

  /**
   * Handle an IPC event (for ipcMain.on)
   * @param eventName - The name of the event being handled
   * @param event - The IPC event object
   * @param args - Arguments passed from renderer
   */
  handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> | void;

  /**
   * Handle an IPC invoke event (for ipcMain.handle)
   * @param eventName - The name of the event being handled
   * @param event - The IPC invoke event object
   * @param args - Arguments passed from renderer
   * @returns Result to send back to renderer
   */
  handleInvoke?(eventName: string, event: IpcMainInvokeEvent, ...args: any[]): Promise<any> | any;
}
