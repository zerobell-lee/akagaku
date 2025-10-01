/**
 * Trigger - Base interface for ghost-initiated conversation triggers
 *
 * Triggers determine when the ghost should proactively start conversations
 * Examples: idle timeout, specific time, external events
 */

/**
 * Trigger execution result
 */
export interface TriggerResult {
  /** Whether this trigger should fire */
  shouldFire: boolean;
  /** System message to send to ghost if firing */
  message?: string;
  /** Priority when multiple triggers fire (higher = more important) */
  priority?: number;
}

/**
 * Trigger context provided to triggers for decision making
 */
export interface TriggerContext {
  /** Last time user interacted with ghost */
  lastInteractionTime: Date;
  /** Current time */
  currentTime: Date;
  /** Character ID */
  characterId: string;
  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * Base Trigger interface
 */
export interface Trigger {
  /** Unique identifier for this trigger */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Whether this trigger is currently enabled */
  enabled: boolean;

  /**
   * Check if this trigger should fire
   * @param context - Current trigger context
   * @returns Trigger result with firing decision and message
   */
  shouldFire(context: TriggerContext): Promise<TriggerResult> | TriggerResult;

  /**
   * Called after trigger fires successfully
   * Used for cooldown management, state updates, etc.
   */
  onFired(): void;

  /**
   * Reset trigger state (e.g., after manual user interaction)
   */
  reset(): void;
}

/**
 * Abstract base class for triggers with common functionality
 */
export abstract class BaseTrigger implements Trigger {
  public enabled: boolean = true;
  protected lastFiredTime: Date | null = null;
  protected cooldownMs: number;

  constructor(
    public readonly id: string,
    public readonly name: string,
    cooldownMs: number = 60000 // Default 1 minute cooldown
  ) {
    this.cooldownMs = cooldownMs;
  }

  /**
   * Check if cooldown period has passed since last fire
   */
  protected isInCooldown(currentTime: Date): boolean {
    if (!this.lastFiredTime) {
      return false;
    }
    return currentTime.getTime() - this.lastFiredTime.getTime() < this.cooldownMs;
  }

  abstract shouldFire(context: TriggerContext): Promise<TriggerResult> | TriggerResult;

  onFired(): void {
    this.lastFiredTime = new Date();
  }

  reset(): void {
    this.lastFiredTime = null;
  }
}
