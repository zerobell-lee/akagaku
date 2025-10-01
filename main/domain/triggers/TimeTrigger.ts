import { BaseTrigger, TriggerContext, TriggerResult } from './Trigger';

/**
 * TimeSlot - Represents a specific time trigger configuration
 */
export interface TimeSlot {
  /** Hour (0-23) */
  hour: number;
  /** Minute (0-59) */
  minute: number;
  /** Message to send at this time */
  message: string;
  /** Optional: Days of week (0=Sunday, 6=Saturday). If undefined, fires every day */
  daysOfWeek?: number[];
}

/**
 * TimeTrigger - Fires at specific times of day
 *
 * Example: Greet user at midnight, remind at 9 AM, etc.
 */
export class TimeTrigger extends BaseTrigger {
  private timeSlots: TimeSlot[];
  private lastCheckedDate: string | null = null;
  private firedSlots: Set<string> = new Set(); // Format: "YYYY-MM-DD:HH:MM"
  private priority: number;

  constructor({
    id = 'time-based',
    name = 'Time-based Trigger',
    timeSlots = [],
    cooldownMs = 30 * 60 * 1000, // 30 minutes cooldown between different time triggers
    priority = 70
  }: {
    id?: string;
    name?: string;
    timeSlots?: TimeSlot[];
    cooldownMs?: number;
    priority?: number;
  } = {}) {
    super(id, name, cooldownMs);
    this.timeSlots = timeSlots;
    this.priority = priority;
  }

  shouldFire(context: TriggerContext): TriggerResult {
    if (!this.enabled || this.timeSlots.length === 0) {
      return { shouldFire: false };
    }

    const currentDate = context.currentTime;
    const currentDateStr = this.formatDate(currentDate);
    const currentHour = currentDate.getHours();
    const currentMinute = currentDate.getMinutes();
    const currentDayOfWeek = currentDate.getDay();

    // Reset fired slots on new day
    if (this.lastCheckedDate !== currentDateStr) {
      this.firedSlots.clear();
      this.lastCheckedDate = currentDateStr;
    }

    // Check each time slot
    for (const slot of this.timeSlots) {
      // Check day of week constraint if specified
      if (slot.daysOfWeek && !slot.daysOfWeek.includes(currentDayOfWeek)) {
        continue;
      }

      // Check if this slot matches current time
      if (slot.hour === currentHour && slot.minute === currentMinute) {
        const slotKey = `${currentDateStr}:${this.formatTime(slot.hour, slot.minute)}`;

        // Check if already fired today
        if (this.firedSlots.has(slotKey)) {
          continue;
        }

        // Check cooldown
        if (this.isInCooldown(context.currentTime)) {
          continue;
        }

        // Mark as fired
        this.firedSlots.add(slotKey);

        return {
          shouldFire: true,
          message: slot.message,
          priority: this.priority
        };
      }
    }

    return { shouldFire: false };
  }

  /**
   * Add a time slot
   */
  addTimeSlot(slot: TimeSlot): void {
    this.timeSlots.push(slot);
  }

  /**
   * Remove a time slot by hour and minute
   */
  removeTimeSlot(hour: number, minute: number): void {
    this.timeSlots = this.timeSlots.filter(
      slot => !(slot.hour === hour && slot.minute === minute)
    );
  }

  /**
   * Clear all time slots
   */
  clearTimeSlots(): void {
    this.timeSlots = [];
  }

  /**
   * Set priority for all time triggers
   */
  setPriority(priority: number): void {
    this.priority = priority;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private formatTime(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  reset(): void {
    super.reset();
    this.firedSlots.clear();
    this.lastCheckedDate = null;
  }
}
