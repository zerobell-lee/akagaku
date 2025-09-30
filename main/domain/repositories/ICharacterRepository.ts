import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { CharacterAppearance } from "@shared/types";

/**
 * Character Repository Interface
 *
 * Domain layer interface for character data access.
 * Implementation should be in infrastructure layer.
 */
export interface ICharacterRepository {
  /**
   * Get character settings by character ID
   */
  getCharacterSetting(characterId: string): CharacterSetting;

  /**
   * Calculate character's attitude based on affection level
   */
  calcAttitude(characterName: string, affection: number): string;

  /**
   * Get character appearance configuration
   */
  getCharacterAppearance(characterName: string): CharacterAppearance;
}