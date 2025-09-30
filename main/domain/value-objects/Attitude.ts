/**
 * Attitude Value Object
 *
 * Represents character's attitude towards user based on affection level.
 * Immutable value object that encapsulates attitude logic.
 */
export class Attitude {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Create Attitude from string value
   */
  static create(value: string): Attitude {
    return new Attitude(value);
  }

  /**
   * Create neutral Attitude
   */
  static neutral(): Attitude {
    return new Attitude("neutral");
  }

  /**
   * Get string value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check if attitude is positive
   */
  isPositive(): boolean {
    return this.value.includes("우호적") || this.value.includes("friendly");
  }

  /**
   * Check if attitude is negative
   */
  isNegative(): boolean {
    return this.value.includes("적대적") || this.value.includes("hostile");
  }

  /**
   * Check if attitude is neutral
   */
  isNeutral(): boolean {
    return this.value === "neutral";
  }

  /**
   * Compare with another Attitude
   */
  equals(other: Attitude): boolean {
    return this.value === other.value;
  }

  /**
   * String representation
   */
  toString(): string {
    return `Attitude(${this.value})`;
  }
}