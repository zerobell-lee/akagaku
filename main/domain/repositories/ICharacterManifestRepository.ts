import { CharacterManifest } from '@shared/types';

/**
 * Character Manifest Repository Interface
 *
 * Domain layer interface for character manifest operations.
 * Manages character metadata including manifest version for future compatibility.
 */
export interface ICharacterManifestRepository {
  /**
   * Get manifest for a specific character
   * @param characterId - Unique character identifier
   * @returns Character manifest with metadata
   */
  getCharacterManifest(characterId: string): CharacterManifest;

  /**
   * Get list of all available characters
   * @returns Array of character manifests
   */
  getAllCharacterManifests(): CharacterManifest[];

  /**
   * Check if a character exists
   * @param characterId - Unique character identifier
   * @returns True if character exists
   */
  characterExists(characterId: string): boolean;
}
