import { SkinManifest, CharacterAppearance } from "@shared/types";

/**
 * Skin Repository Interface
 *
 * Domain layer interface for skin data access.
 * Implementation should be in infrastructure layer.
 */
export interface ISkinRepository {
  /**
   * Get all available skins for a character
   */
  getAvailableSkins(characterId: string): SkinManifest[];

  /**
   * Get skin appearance configuration
   */
  getSkinAppearance(characterId: string, skinId: string): CharacterAppearance;

  /**
   * Get skin manifest metadata
   */
  getSkinManifest(characterId: string, skinId: string): SkinManifest;

  /**
   * Get currently active skin ID for a character
   */
  getActiveSkin(characterId: string): string;

  /**
   * Set active skin for a character
   */
  setActiveSkin(characterId: string, skinId: string): void;

  /**
   * Check if skin exists
   */
  skinExists(characterId: string, skinId: string): boolean;
}
