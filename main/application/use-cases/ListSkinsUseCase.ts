import { ISkinRepository } from '../../domain/repositories/ISkinRepository';
import { SkinManifest } from '@shared/types';

/**
 * ListSkinsUseCase - List available skins for a character
 *
 * Returns all available skins for a character with their metadata.
 */
export class ListSkinsUseCase {
  constructor(private skinRepository: ISkinRepository) {}

  execute(characterId: string): SkinManifest[] {
    return this.skinRepository.getAvailableSkins(characterId);
  }
}
