import { BaseTrigger, TriggerContext, TriggerResult } from './Trigger';

/**
 * IntervalTrigger - Fires after a specified idle period
 *
 * Example: Start chit-chat if user hasn't interacted for 5 minutes
 */
export class IntervalTrigger extends BaseTrigger {
  private intervalMs: number;
  private messages: string[];
  private priority: number;

  constructor({
    id = 'interval-idle',
    name = 'Idle Interval Trigger',
    intervalMs = 5 * 60 * 1000, // Default 5 minutes
    cooldownMs = 10 * 60 * 1000, // Default 10 minutes cooldown
    messages = ['Have a chit chat with the user. Don\'t use any tools.'],
    priority = 50
  }: {
    id?: string;
    name?: string;
    intervalMs?: number;
    cooldownMs?: number;
    messages?: string[];
    priority?: number;
  } = {}) {
    super(id, name, cooldownMs);
    this.intervalMs = intervalMs;
    this.messages = messages;
    this.priority = priority;
  }

  shouldFire(context: TriggerContext): TriggerResult {
    if (!this.enabled) {
      return { shouldFire: false };
    }

    // Check cooldown first
    if (this.isInCooldown(context.currentTime)) {
      return { shouldFire: false };
    }

    // Calculate time since last interaction
    const timeSinceInteraction = context.currentTime.getTime() - context.lastInteractionTime.getTime();

    // Fire if interval has passed
    if (timeSinceInteraction >= this.intervalMs) {
      // Pick random message if multiple available
      const message = this.messages[Math.floor(Math.random() * this.messages.length)];

      return {
        shouldFire: true,
        message,
        priority: this.priority
      };
    }

    return { shouldFire: false };
  }

  /**
   * Update interval duration
   */
  setInterval(intervalMs: number): void {
    this.intervalMs = intervalMs;
  }

  /**
   * Add additional message variations
   */
  addMessage(message: string): void {
    this.messages.push(message);
  }

  /**
   * Set message priority
   */
  setPriority(priority: number): void {
    this.priority = priority;
  }
}
