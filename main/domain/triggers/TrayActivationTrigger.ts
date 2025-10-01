import { BaseTrigger, TriggerContext, TriggerResult } from './Trigger';

/**
 * TrayActivationTrigger - Fires when user activates ghost from tray
 *
 * This trigger fires when:
 * - Ghost was hidden/moved to tray
 * - User clicks tray icon to show ghost again
 */
export class TrayActivationTrigger extends BaseTrigger {
  private wasActivated: boolean = false;
  private priority: number;
  private messages: string[];

  constructor({
    id = 'tray-activation',
    name = 'Tray Activation Trigger',
    cooldownMs = 60000,
    messages = ['User just brought you back from the tray icon. Express relief or comment about being cramped. Don\'t use any tools.'],
    priority = 80
  }: {
    id?: string;
    name?: string;
    cooldownMs?: number;
    messages?: string[];
    priority?: number;
  } = {}) {
    super(id, name, cooldownMs);
    this.messages = messages;
    this.priority = priority;
  }

  /**
   * This trigger is manually activated, not automatically checked
   * Call activate() when user clicks tray icon
   */
  shouldFire(context: TriggerContext): TriggerResult {
    if (!this.enabled) {
      return { shouldFire: false };
    }

    // Check cooldown
    if (this.isInCooldown(context.currentTime)) {
      return { shouldFire: false };
    }

    // Check if was activated
    if (this.wasActivated) {
      // Reset flag and fire
      this.wasActivated = false;

      // Pick random message
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
   * Activate this trigger
   * Call this when user clicks tray icon to show ghost
   */
  activate(): void {
    this.wasActivated = true;
    console.log('[TrayActivationTrigger] Activated');
  }

  /**
   * Add message variation
   */
  addMessage(message: string): void {
    this.messages.push(message);
  }

  /**
   * Set priority
   */
  setPriority(priority: number): void {
    this.priority = priority;
  }

  reset(): void {
    super.reset();
    this.wasActivated = false;
  }
}
