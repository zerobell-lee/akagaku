import { ISkinRepository } from '../../domain/repositories/ISkinRepository';
import { SkinManifest } from '@shared/types';

export interface ChangeSkinInput {
  characterId: string;
  skinId: string;
}

export interface ChangeSkinOutput {
  success: boolean;
  previousSkin: string;
  newSkin: string;
  newSkinManifest: SkinManifest;
  triggerMessage: string;
}

/**
 * ChangeSkinUseCase - Change character skin
 *
 * Changes the active skin for a character and generates a system message
 * for the AI to react to the skin change.
 */
export class ChangeSkinUseCase {
  constructor(private skinRepository: ISkinRepository) {}

  execute(input: ChangeSkinInput): ChangeSkinOutput {
    const { characterId, skinId } = input;

    // Validate skin exists
    if (!this.skinRepository.skinExists(characterId, skinId)) {
      throw new Error(`Skin ${skinId} does not exist for character ${characterId}`);
    }

    // Get current skin before changing
    const previousSkinId = this.skinRepository.getActiveSkin(characterId);

    // Change to new skin
    this.skinRepository.setActiveSkin(characterId, skinId);

    // Get new skin manifest for AI context
    const newSkinManifest = this.skinRepository.getSkinManifest(characterId, skinId);

    // Generate trigger message for AI
    const triggerMessage = `User just changed your outfit. You are now wearing: ${newSkinManifest.description}. React to your new appearance.`;

    return {
      success: true,
      previousSkin: previousSkinId,
      newSkin: skinId,
      newSkinManifest,
      triggerMessage
    };
  }
}
