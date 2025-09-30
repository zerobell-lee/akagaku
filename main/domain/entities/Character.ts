import { Emoticon } from "../value-objects/Emoticon";

/**
 * Character Entity
 *
 * Domain entity representing a character in the system.
 * Pure domain object without framework dependencies.
 */
export class Character {
  private readonly id: string;
  private readonly name: string;
  private readonly description: string;
  private readonly availableEmoticons: string[];
  private readonly touchableArea: any | null;

  private constructor(
    id: string,
    name: string,
    description: string,
    availableEmoticons: string[],
    touchableArea: any | null
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.availableEmoticons = availableEmoticons;
    this.touchableArea = touchableArea;
  }

  /**
   * Create Character from raw data
   */
  static create(data: {
    character_id: string;
    character_name: string;
    description: string;
    available_emoticon: string[];
    touchable_area: any | null;
  }): Character {
    return new Character(
      data.character_id,
      data.character_name,
      data.description,
      data.available_emoticon || ["neutral"],
      data.touchable_area
    );
  }

  /**
   * Create emoticon with validation
   */
  createEmoticon(value: string): Emoticon {
    return Emoticon.create(value, this.availableEmoticons);
  }

  /**
   * Check if emoticon is available
   */
  hasEmoticon(emoticon: string): boolean {
    return this.availableEmoticons.includes(emoticon);
  }

  // Getters
  getId(): string {
    return this.id;
  }

  getName(): string {
    return this.name;
  }

  getDescription(): string {
    return this.description;
  }

  getAvailableEmoticons(): string[] {
    return [...this.availableEmoticons]; // Return copy for immutability
  }

  getTouchableArea(): any | null {
    return this.touchableArea;
  }

  /**
   * Convert to raw format for legacy compatibility
   */
  toRaw(): {
    character_id: string;
    character_name: string;
    description: string;
    available_emoticon: string[];
    touchable_area: any | null;
  } {
    return {
      character_id: this.id,
      character_name: this.name,
      description: this.description,
      available_emoticon: this.availableEmoticons,
      touchable_area: this.touchableArea
    };
  }

  /**
   * String representation
   */
  toString(): string {
    return `Character(${this.id}, ${this.name})`;
  }
}