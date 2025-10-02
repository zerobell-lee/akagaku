import { IpcMain } from 'electron';
import { IIPCHandler } from './IIPCHandler';
import { logger } from '../../infrastructure/config/logger';

/**
 * IPCRegistry - Central registry for all IPC event handlers
 *
 * This is the ONLY place where ipcMain should be accessed directly.
 * All IPC event registration must go through this registry.
 *
 * Benefits:
 * - Prevents direct ipcMain usage in background.ts
 * - Ensures all handlers implement IIPCHandler interface
 * - Detects duplicate event registration
 * - Provides single source of truth for all IPC events
 * - Enables centralized logging and error handling
 */
export class IPCRegistry {
  private handlers: Map<string, IIPCHandler> = new Map();
  private registeredEvents: Set<string> = new Set();
  private initialized: boolean = false;

  /**
   * Register a handler for IPC events
   * Must be called before initialize()
   */
  registerHandler(handler: IIPCHandler): void {
    if (this.initialized) {
      throw new Error('[IPCRegistry] Cannot register handlers after initialization');
    }

    const eventNames = handler.getEventNames();
    const invokeEventNames = (handler as any).getInvokeEventNames?.() || [];
    const allEventNames = [...eventNames, ...invokeEventNames];

    // Validate handler
    if (allEventNames.length === 0) {
      throw new Error('[IPCRegistry] Handler must handle at least one event');
    }

    // Check for duplicate registrations
    for (const eventName of allEventNames) {
      if (this.registeredEvents.has(eventName)) {
        const existingHandler = this.handlers.get(eventName);
        throw new Error(
          `[IPCRegistry] Event "${eventName}" is already registered by ${existingHandler?.constructor.name}`
        );
      }

      this.handlers.set(eventName, handler);
      this.registeredEvents.add(eventName);
      logger.info(`[IPCRegistry] Registered handler for event: ${eventName}`);
    }
  }

  /**
   * Initialize the registry and bind all handlers to ipcMain
   * Should be called only once in background.ts after all handlers are registered
   */
  initialize(ipcMain: IpcMain): void {
    if (this.initialized) {
      throw new Error('[IPCRegistry] Registry already initialized');
    }

    if (this.handlers.size === 0) {
      logger.warn('[IPCRegistry] No handlers registered');
      return;
    }

    // Bind all registered events to ipcMain
    this.handlers.forEach((handler, eventName) => {
      // Check if this is an invoke event by checking if handler has getInvokeEventNames
      const invokeEventNames = (handler as any).getInvokeEventNames?.() || [];
      const isInvokeEvent = invokeEventNames.includes(eventName);

      if (isInvokeEvent && handler.handleInvoke && typeof handler.handleInvoke === 'function') {
        logger.debug(`[IPCRegistry] Registering INVOKE handler for: ${eventName}`);
        ipcMain.handle(eventName, async (event, ...args) => {
          try {
            logger.debug(`[IPCRegistry] INVOKE event received: ${eventName}`);
            return await handler.handleInvoke!(eventName, event, ...args);
          } catch (error) {
            logger.error(`[IPCRegistry] Error handling invoke event ${eventName}:`, error);
            throw error;
          }
        });
      } else {
        // Regular on event
        logger.debug(`[IPCRegistry] Registering ON handler for: ${eventName}`);
        ipcMain.on(eventName, async (event, ...args) => {
          try {
            logger.debug(`[IPCRegistry] ON event received: ${eventName}`);
            await handler.handle(eventName, event, ...args);
          } catch (error) {
            logger.error(`[IPCRegistry] Error handling event ${eventName}:`, error);
          }
        });
      }
    });

    this.initialized = true;
    logger.info(`[IPCRegistry] Initialized with ${this.registeredEvents.size} events`);
  }

  /**
   * Get all registered event names (for debugging/monitoring)
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.registeredEvents);
  }

  /**
   * Check if an event is registered
   */
  isEventRegistered(eventName: string): boolean {
    return this.registeredEvents.has(eventName);
  }

  /**
   * Get handler for a specific event (for testing)
   */
  getHandler(eventName: string): IIPCHandler | undefined {
    return this.handlers.get(eventName);
  }

  // Singleton instance
  private static _instance: IPCRegistry;

  static get instance(): IPCRegistry {
    if (!IPCRegistry._instance) {
      IPCRegistry._instance = new IPCRegistry();
    }
    return IPCRegistry._instance;
  }

  // Private constructor to enforce singleton
  private constructor() {}
}
