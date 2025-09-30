import { Affection } from "../value-objects/Affection";
import { Attitude } from "../value-objects/Attitude";

/**
 * Relationship Entity
 *
 * Domain entity representing the relationship between a character and the user.
 * Encapsulates character-user interaction state and relationship evolution logic.
 */
export class Relationship {
  private readonly characterId: string;
  private readonly affection: Affection;
  private readonly attitude: Attitude;

  private constructor(characterId: string, affection: Affection, attitude: Attitude) {
    this.characterId = characterId;
    this.affection = affection;
    this.attitude = attitude;
  }

  /**
   * Create new Relationship
   */
  static create(characterId: string, affection: Affection, attitude: Attitude): Relationship {
    return new Relationship(characterId, affection, attitude);
  }

  /**
   * Create default Relationship (neutral)
   */
  static createDefault(characterId: string): Relationship {
    return new Relationship(
      characterId,
      Affection.default(),
      Attitude.neutral()
    );
  }

  /**
   * Create from raw data (for repository layer)
   */
  static fromRaw(data: { character: string; affection_to_user: number; attitude_to_user: string }): Relationship {
    return new Relationship(
      data.character,
      Affection.create(data.affection_to_user),
      Attitude.create(data.attitude_to_user)
    );
  }

  /**
   * Update affection based on interaction
   */
  updateAffection(delta: number): Relationship {
    const newAffection = this.affection.add(delta);
    return new Relationship(this.characterId, newAffection, this.attitude);
  }

  /**
   * Update attitude based on new affection level
   */
  updateAttitude(newAttitude: Attitude): Relationship {
    return new Relationship(this.characterId, this.affection, newAttitude);
  }

  /**
   * Update both affection and attitude (full update)
   */
  update(delta: number, newAttitude: Attitude): Relationship {
    const newAffection = this.affection.add(delta);
    return new Relationship(this.characterId, newAffection, newAttitude);
  }

  /**
   * Convert to raw format for persistence
   */
  toRaw(): { character: string; affection_to_user: number; attitude_to_user: string } {
    return {
      character: this.characterId,
      affection_to_user: this.affection.getValue(),
      attitude_to_user: this.attitude.getValue()
    };
  }

  // Getters
  getCharacterId(): string {
    return this.characterId;
  }

  getAffection(): Affection {
    return this.affection;
  }

  getAttitude(): Attitude {
    return this.attitude;
  }

  /**
   * Check if relationship is positive
   */
  isPositive(): boolean {
    return this.affection.isHigh() || this.attitude.isPositive();
  }

  /**
   * Check if relationship is negative
   */
  isNegative(): boolean {
    return this.affection.isLow() || this.attitude.isNegative();
  }

  /**
   * String representation
   */
  toString(): string {
    return `Relationship(${this.characterId}, ${this.affection.toString()}, ${this.attitude.toString()})`;
  }
}