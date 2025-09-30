import { IRelationshipRepository } from "main/domain/repositories/IRelationshipRepository";
import { ICharacterRepository } from "main/domain/repositories/ICharacterRepository";
import { Relationship } from "main/domain/entities/Relationship";
import { Affection } from "main/domain/value-objects/Affection";
import { Attitude } from "main/domain/value-objects/Attitude";

/**
 * Update Relationship Use Case
 *
 * Application layer use case for updating character-user relationship.
 * Applies domain business rules for affection and attitude changes.
 */
export class UpdateRelationshipUseCase {
  constructor(
    private readonly relationshipRepo: IRelationshipRepository,
    private readonly characterRepo: ICharacterRepository
  ) {}

  /**
   * Execute the use case
   *
   * Updates relationship based on affection delta and calculates new attitude.
   */
  async execute(
    characterId: string,
    affectionDelta: number
  ): Promise<Relationship> {
    // Get current relationship
    const rawRelationship = this.relationshipRepo.getCharacterRelationships(characterId);
    const relationship = Relationship.fromRaw(rawRelationship);

    // Update affection
    const newAffection = relationship.getAffection().add(affectionDelta);

    // Calculate new attitude based on affection level
    const attitudeString = this.characterRepo.calcAttitude(characterId, newAffection.getValue());
    const newAttitude = Attitude.create(attitudeString);

    // Create updated relationship
    const updatedRelationship = relationship.update(affectionDelta, newAttitude);

    // Persist
    await this.relationshipRepo.updateCharacterRelationships(
      characterId,
      updatedRelationship.getAffection().getValue(),
      updatedRelationship.getAttitude().getValue()
    );

    return updatedRelationship;
  }
}

/**
 * Factory function to create UpdateRelationshipUseCase with dependencies
 */
export function createUpdateRelationshipUseCase(
  relationshipRepo: IRelationshipRepository,
  characterRepo: ICharacterRepository
): UpdateRelationshipUseCase {
  return new UpdateRelationshipUseCase(relationshipRepo, characterRepo);
}