import { Relationship } from "main/infrastructure/user/RelationshipRepository";

/**
 * Relationship Repository Interface
 *
 * Domain layer interface for character-user relationship management.
 * Implementation should be in infrastructure layer.
 */
export interface IRelationshipRepository {
  /**
   * Get relationship data for a specific character
   */
  getCharacterRelationships(characterName: string): Relationship;

  /**
   * Update character relationship (affection and attitude)
   */
  updateCharacterRelationships(
    characterName: string,
    affectionToUser: number,
    attitudeToUser: string
  ): Promise<Relationship>;
}