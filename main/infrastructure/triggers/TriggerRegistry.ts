import Store from 'electron-store';
import { IntervalTrigger } from '../../domain/triggers/IntervalTrigger';
import { TimeTrigger, TimeSlot } from '../../domain/triggers/TimeTrigger';
import { Trigger } from '../../domain/triggers/Trigger';

/**
 * Trigger configuration for persistence
 */
export interface TriggerConfig {
  enabled: boolean;
  // Interval trigger config
  intervalMs?: number;
  cooldownMs?: number;
  messages?: string[];
  priority?: number;
  // Time trigger config
  timeSlots?: TimeSlot[];
}

/**
 * TriggerRegistry - Infrastructure layer for trigger configuration
 *
 * Manages trigger configurations using electron-store
 */
export class TriggerRegistry {
  private store: Store;
  private readonly configKey = 'trigger_configs';

  constructor() {
    this.store = new Store({
      name: 'trigger-config'
    });
  }

  /**
   * Get trigger configuration
   */
  getTriggerConfig(triggerId: string): TriggerConfig | null {
    const configs = this.store.get(this.configKey, {}) as Record<string, TriggerConfig>;
    return configs[triggerId] || null;
  }

  /**
   * Save trigger configuration
   */
  saveTriggerConfig(triggerId: string, config: TriggerConfig): void {
    const configs = this.store.get(this.configKey, {}) as Record<string, TriggerConfig>;
    configs[triggerId] = config;
    this.store.set(this.configKey, configs);
    console.log(`[TriggerRegistry] Saved config for ${triggerId}`);
  }

  /**
   * Delete trigger configuration
   */
  deleteTriggerConfig(triggerId: string): void {
    const configs = this.store.get(this.configKey, {}) as Record<string, TriggerConfig>;
    delete configs[triggerId];
    this.store.set(this.configKey, configs);
    console.log(`[TriggerRegistry] Deleted config for ${triggerId}`);
  }

  /**
   * Get all trigger configurations
   */
  getAllTriggerConfigs(): Record<string, TriggerConfig> {
    return this.store.get(this.configKey, {}) as Record<string, TriggerConfig>;
  }

  /**
   * Create default triggers with saved configurations
   */
  createDefaultTriggers(): Trigger[] {
    const configs = this.getAllTriggerConfigs();
    const triggers: Trigger[] = [];

    // Create interval trigger (5-minute idle)
    const intervalConfig = configs['interval-idle'] || {
      enabled: true,
      intervalMs: 5 * 60 * 1000,
      cooldownMs: 10 * 60 * 1000,
      messages: ['Have a chit chat with the user. Don\'t use any tools.'],
      priority: 50
    };

    const intervalTrigger = new IntervalTrigger({
      id: 'interval-idle',
      name: '5-Minute Idle Chat',
      ...intervalConfig
    });
    intervalTrigger.enabled = intervalConfig.enabled;
    triggers.push(intervalTrigger);

    // Create time trigger (midnight greeting)
    const timeConfig = configs['time-midnight'] || {
      enabled: true,
      timeSlots: [
        {
          hour: 0,
          minute: 0,
          message: 'It\'s midnight now. Make a casual comment about the time. Don\'t use any tools.'
        }
      ],
      cooldownMs: 30 * 60 * 1000,
      priority: 70
    };

    const timeTrigger = new TimeTrigger({
      id: 'time-midnight',
      name: 'Midnight Greeting',
      ...timeConfig
    });
    timeTrigger.enabled = timeConfig.enabled;
    triggers.push(timeTrigger);

    // Save default configs if not exist
    if (!configs['interval-idle']) {
      this.saveTriggerConfig('interval-idle', intervalConfig);
    }
    if (!configs['time-midnight']) {
      this.saveTriggerConfig('time-midnight', timeConfig);
    }

    console.log(`[TriggerRegistry] Created ${triggers.length} default triggers`);
    return triggers;
  }

  /**
   * Update trigger enabled status
   */
  setTriggerEnabled(triggerId: string, enabled: boolean): void {
    const config = this.getTriggerConfig(triggerId);
    if (config) {
      config.enabled = enabled;
      this.saveTriggerConfig(triggerId, config);
    }
  }

  /**
   * Update interval trigger settings
   */
  updateIntervalTrigger(triggerId: string, updates: Partial<TriggerConfig>): void {
    const config = this.getTriggerConfig(triggerId) || { enabled: true };
    const updatedConfig = { ...config, ...updates };
    this.saveTriggerConfig(triggerId, updatedConfig);
  }

  /**
   * Update time trigger settings
   */
  updateTimeTrigger(triggerId: string, updates: Partial<TriggerConfig>): void {
    const config = this.getTriggerConfig(triggerId) || { enabled: true };
    const updatedConfig = { ...config, ...updates };
    this.saveTriggerConfig(triggerId, updatedConfig);
  }

  /**
   * Reset all trigger configurations to defaults
   */
  resetToDefaults(): void {
    this.store.delete(this.configKey);
    console.log('[TriggerRegistry] Reset to defaults');
  }
}

// Singleton instance
export const triggerRegistry = new TriggerRegistry();
