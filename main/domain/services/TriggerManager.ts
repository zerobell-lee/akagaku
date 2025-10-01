import { Trigger, TriggerContext, TriggerResult } from '../triggers/Trigger';

/**
 * TriggerManager - Domain service for managing ghost conversation triggers
 *
 * Responsibilities:
 * - Register and manage multiple triggers
 * - Periodically check triggers and determine which should fire
 * - Handle priority resolution when multiple triggers fire
 * - Provide callbacks for trigger firing
 */
export class TriggerManager {
  private triggers: Map<string, Trigger> = new Map();
  private checkIntervalMs: number;
  private intervalHandle: NodeJS.Timeout | null = null;
  private onTriggerFire: ((message: string, triggerId: string) => void) | null = null;
  private contextProvider: (() => Omit<TriggerContext, 'currentTime'>) | null = null;

  constructor(checkIntervalMs: number = 60000) {
    // Default: check every minute
    this.checkIntervalMs = checkIntervalMs;
  }

  /**
   * Register a trigger
   */
  registerTrigger(trigger: Trigger): void {
    if (this.triggers.has(trigger.id)) {
      console.warn(`[TriggerManager] Trigger ${trigger.id} already registered, replacing`);
    }
    this.triggers.set(trigger.id, trigger);
    console.log(`[TriggerManager] Registered trigger: ${trigger.name} (${trigger.id})`);
  }

  /**
   * Unregister a trigger
   */
  unregisterTrigger(triggerId: string): void {
    if (this.triggers.delete(triggerId)) {
      console.log(`[TriggerManager] Unregistered trigger: ${triggerId}`);
    }
  }

  /**
   * Get a trigger by ID
   */
  getTrigger(triggerId: string): Trigger | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Get all registered triggers
   */
  getAllTriggers(): Trigger[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Enable a trigger
   */
  enableTrigger(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = true;
      console.log(`[TriggerManager] Enabled trigger: ${triggerId}`);
    }
  }

  /**
   * Disable a trigger
   */
  disableTrigger(triggerId: string): void {
    const trigger = this.triggers.get(triggerId);
    if (trigger) {
      trigger.enabled = false;
      console.log(`[TriggerManager] Disabled trigger: ${triggerId}`);
    }
  }

  /**
   * Set callback for when triggers fire
   */
  setOnTriggerFire(callback: (message: string, triggerId: string) => void): void {
    this.onTriggerFire = callback;
  }

  /**
   * Start periodic trigger checking
   * @param contextProvider - Function that provides current context (called on each check)
   */
  start(contextProvider: () => Omit<TriggerContext, 'currentTime'>): void {
    if (this.intervalHandle) {
      console.warn('[TriggerManager] Already started');
      return;
    }

    this.contextProvider = contextProvider;
    console.log(`[TriggerManager] Starting with ${this.triggers.size} triggers`);

    // Check immediately
    this.checkTriggers();

    // Then check periodically
    this.intervalHandle = setInterval(() => {
      this.checkTriggers();
    }, this.checkIntervalMs);
  }

  /**
   * Stop periodic trigger checking
   */
  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('[TriggerManager] Stopped');
    }
  }

  /**
   * Manually check all triggers
   */
  async checkTriggers(): Promise<void> {
    if (!this.contextProvider) {
      console.warn('[TriggerManager] No context provider set');
      return;
    }

    const context = this.contextProvider();
    const fullContext: TriggerContext = {
      ...context,
      currentTime: new Date()
    };

    const firedTriggers: Array<{ trigger: Trigger; result: TriggerResult }> = [];

    // Check all enabled triggers
    for (const trigger of Array.from(this.triggers.values())) {
      if (!trigger.enabled) {
        continue;
      }

      try {
        const result = await trigger.shouldFire(fullContext);
        if (result.shouldFire && result.message) {
          firedTriggers.push({ trigger, result });
        }
      } catch (error) {
        console.error(`[TriggerManager] Error checking trigger ${trigger.id}:`, error);
      }
    }

    // If multiple triggers fired, select highest priority
    if (firedTriggers.length > 0) {
      const selected = firedTriggers.reduce((highest, current) => {
        const highestPriority = highest.result.priority ?? 0;
        const currentPriority = current.result.priority ?? 0;
        return currentPriority > highestPriority ? current : highest;
      });

      console.log(`[TriggerManager] Trigger fired: ${selected.trigger.name} (priority: ${selected.result.priority ?? 0})`);

      // Mark trigger as fired
      selected.trigger.onFired();

      // Execute callback
      if (this.onTriggerFire && selected.result.message) {
        this.onTriggerFire(selected.result.message, selected.trigger.id);
      }
    }
  }

  /**
   * Reset all triggers (e.g., after manual user interaction)
   */
  resetAllTriggers(): void {
    for (const trigger of Array.from(this.triggers.values())) {
      trigger.reset();
    }
    console.log('[TriggerManager] All triggers reset');
  }

  /**
   * Update last interaction time for all triggers
   * This should be called after any user interaction
   */
  updateLastInteraction(lastInteractionTime: Date): void {
    // Triggers will use this in their next check
    // We don't need to store it here since it's passed in checkTriggers
    console.log('[TriggerManager] Last interaction updated:', lastInteractionTime.toISOString());
  }

  /**
   * Get trigger statistics
   */
  getStats(): {
    total: number;
    enabled: number;
    disabled: number;
  } {
    const triggers = Array.from(this.triggers.values());
    return {
      total: triggers.length,
      enabled: triggers.filter(t => t.enabled).length,
      disabled: triggers.filter(t => !t.enabled).length
    };
  }
}
