/**
 * Affection Value Object
 *
 * Represents character's affection level towards user.
 * Encapsulates affection business rules:
 * - Range: 0-100
 * - Immutable: operations return new instance
 */
export class Affection {
  private readonly value: number;

  private static readonly MIN_VALUE = 0;
  private static readonly MAX_VALUE = 100;
  private static readonly DEFAULT_VALUE = 50;

  private constructor(value: number) {
    this.value = this.clamp(value);
  }

  /**
   * Create Affection from value
   */
  static create(value: number): Affection {
    return new Affection(value);
  }

  /**
   * Create default Affection (neutral)
   */
  static default(): Affection {
    return new Affection(this.DEFAULT_VALUE);
  }

  /**
   * Add affection points (immutable)
   */
  add(delta: number): Affection {
    return new Affection(this.value + delta);
  }

  /**
   * Subtract affection points (immutable)
   */
  subtract(delta: number): Affection {
    return new Affection(this.value - delta);
  }

  /**
   * Get numeric value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Check if affection is high (>= 80)
   */
  isHigh(): boolean {
    return this.value >= 80;
  }

  /**
   * Check if affection is low (<= 20)
   */
  isLow(): boolean {
    return this.value <= 20;
  }

  /**
   * Check if affection is neutral (40-60)
   */
  isNeutral(): boolean {
    return this.value >= 40 && this.value <= 60;
  }

  /**
   * Compare with another Affection
   */
  equals(other: Affection): boolean {
    return this.value === other.value;
  }

  /**
   * Clamp value to valid range
   */
  private clamp(value: number): number {
    return Math.min(Math.max(value, Affection.MIN_VALUE), Affection.MAX_VALUE);
  }

  /**
   * String representation
   */
  toString(): string {
    return `Affection(${this.value})`;
  }
}