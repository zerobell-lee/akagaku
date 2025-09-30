/**
 * Emoticon Value Object
 *
 * Represents character's emotional expression.
 * Validates emoticon against available options.
 */
export class Emoticon {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * Create Emoticon with validation
   */
  static create(value: string, availableEmoticons: string[]): Emoticon {
    if (!availableEmoticons.includes(value)) {
      throw new Error(`Invalid emoticon: ${value}. Available: ${availableEmoticons.join(", ")}`);
    }
    return new Emoticon(value);
  }

  /**
   * Create Emoticon without validation (for existing data)
   */
  static createUnsafe(value: string): Emoticon {
    return new Emoticon(value);
  }

  /**
   * Create neutral emoticon
   */
  static neutral(): Emoticon {
    return new Emoticon("neutral");
  }

  /**
   * Common emoticons
   */
  static happy(): Emoticon {
    return new Emoticon("happy");
  }

  static sad(): Emoticon {
    return new Emoticon("sad");
  }

  static angry(): Emoticon {
    return new Emoticon("angry");
  }

  static surprised(): Emoticon {
    return new Emoticon("surprised");
  }

  static embarrassed(): Emoticon {
    return new Emoticon("embarrassed");
  }

  /**
   * Get string value
   */
  getValue(): string {
    return this.value;
  }

  /**
   * Check if emoticon represents positive emotion
   */
  isPositive(): boolean {
    return ["happy", "smile", "excited"].includes(this.value);
  }

  /**
   * Check if emoticon represents negative emotion
   */
  isNegative(): boolean {
    return ["sad", "angry", "annoyed", "disappointed"].includes(this.value);
  }

  /**
   * Compare with another Emoticon
   */
  equals(other: Emoticon): boolean {
    return this.value === other.value;
  }

  /**
   * String representation
   */
  toString(): string {
    return `Emoticon(${this.value})`;
  }
}