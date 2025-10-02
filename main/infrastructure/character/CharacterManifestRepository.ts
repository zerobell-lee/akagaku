import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { CharacterManifest } from '@shared/types';
import { ICharacterManifestRepository } from '../../domain/repositories/ICharacterManifestRepository';
import { logger } from '../config/logger';
import { getDataDirectory } from '../config/ConfigRepository';

/**
 * YAML-based Character Manifest Repository
 *
 * Loads character manifests from data/character/{character_id}/manifest.yaml
 * Supports manifest versioning for backward compatibility
 */
class YamlCharacterManifestRepository implements ICharacterManifestRepository {
  private readonly MANIFEST_CURRENT_VERSION = '1.0';

  /**
   * Get the character directory path
   */
  private getCharacterDirectory(characterId: string): string {
    return path.join(getDataDirectory(), `character/${characterId}`);
  }

  /**
   * Get character manifest with version handling
   */
  getCharacterManifest(characterId: string): CharacterManifest {
    const characterDir = this.getCharacterDirectory(characterId);
    const manifestPath = path.join(characterDir, 'manifest.yaml');

    if (fs.existsSync(manifestPath)) {
      const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8')) as CharacterManifest;

      // Ensure manifest_version is set (default to "1.0" for backward compatibility)
      if (!manifest.manifest_version) {
        logger.warn(`[CharacterManifestRepository] No manifest_version in ${characterId}/manifest.yaml, defaulting to 1.0`);
        manifest.manifest_version = '1.0';
      }

      // Validate required fields based on version
      this.validateManifest(manifest);

      // Validate thumbnail if specified
      if (manifest.thumbnail) {
        this.validateThumbnail(characterDir, manifest.thumbnail, characterId);
      }

      return manifest;
    }

    // Legacy fallback: Create manifest from character_description.yaml
    return this.createLegacyManifest(characterId);
  }

  /**
   * Validate thumbnail file path and existence
   */
  private validateThumbnail(baseDir: string, thumbnailPath: string, characterId: string): void {
    // Check for path traversal attempts
    if (thumbnailPath.includes('..') || path.isAbsolute(thumbnailPath)) {
      logger.error(`[CharacterManifestRepository] Security: Path traversal attempt in character thumbnail for ${characterId}: ${thumbnailPath}`);
      throw new Error(`Invalid thumbnail path: ${thumbnailPath}`);
    }

    // Resolve full path
    const fullPath = path.join(baseDir, thumbnailPath);

    // Check file existence
    if (!fs.existsSync(fullPath)) {
      logger.warn(`[CharacterManifestRepository] Thumbnail file not found for character ${characterId}: ${fullPath}`);
      return; // Don't throw, just log warning
    }

    // Validate file extension
    const ext = path.extname(thumbnailPath).toLowerCase();
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!validExtensions.includes(ext)) {
      logger.warn(`[CharacterManifestRepository] Invalid thumbnail format for character ${characterId}: ${ext} (expected: ${validExtensions.join(', ')})`);
      return;
    }

    // Check file size (max 500KB)
    const stats = fs.statSync(fullPath);
    const maxSize = 500 * 1024; // 500KB
    if (stats.size > maxSize) {
      logger.warn(`[CharacterManifestRepository] Thumbnail file too large for character ${characterId}: ${stats.size} bytes (max: ${maxSize} bytes)`);
      // Don't throw, just log warning - large files can still load
    }

    logger.info(`[CharacterManifestRepository] Thumbnail validated for character ${characterId}: ${thumbnailPath} (${stats.size} bytes)`);
  }

  /**
   * Get all available character manifests
   */
  getAllCharacterManifests(): CharacterManifest[] {
    const charactersBaseDir = path.join(getDataDirectory(), 'character');

    if (!fs.existsSync(charactersBaseDir)) {
      logger.warn('[CharacterManifestRepository] Characters directory not found');
      return [];
    }

    const characterIds = fs.readdirSync(charactersBaseDir).filter(item => {
      const itemPath = path.join(charactersBaseDir, item);
      return fs.statSync(itemPath).isDirectory();
    });

    const manifests: CharacterManifest[] = [];
    for (const characterId of characterIds) {
      try {
        manifests.push(this.getCharacterManifest(characterId));
      } catch (error) {
        logger.error(`[CharacterManifestRepository] Failed to load manifest for ${characterId}:`, error);
      }
    }

    return manifests;
  }

  /**
   * Check if a character exists
   */
  characterExists(characterId: string): boolean {
    const characterDir = this.getCharacterDirectory(characterId);
    return fs.existsSync(characterDir);
  }

  /**
   * Validate manifest based on version
   */
  private validateManifest(manifest: CharacterManifest): void {
    const version = manifest.manifest_version || '1.0';

    // Version 1.0 validation
    if (version === '1.0') {
      if (!manifest.character_id) {
        throw new Error('CharacterManifest v1.0 requires character_id');
      }
      if (!manifest.character_name) {
        throw new Error('CharacterManifest v1.0 requires character_name');
      }
      if (!manifest.description) {
        throw new Error('CharacterManifest v1.0 requires description');
      }
      if (!manifest.version) {
        throw new Error('CharacterManifest v1.0 requires version');
      }
    }

    // Future versions can add additional validation here
    // if (version === '2.0') { ... }
  }

  /**
   * Create legacy manifest from existing character structure
   */
  private createLegacyManifest(characterId: string): CharacterManifest {
    const characterDir = this.getCharacterDirectory(characterId);

    if (!fs.existsSync(characterDir)) {
      throw new Error(`Character directory not found: ${characterId}`);
    }

    logger.warn(`[CharacterManifestRepository] No manifest.yaml found for ${characterId}, creating legacy fallback`);

    // Try to read character_description.yaml for basic info
    const descriptionPath = path.join(characterDir, 'character_description.yaml');
    let characterName = characterId;
    let description = 'A desktop character';

    if (fs.existsSync(descriptionPath)) {
      try {
        const descriptionData = yaml.load(fs.readFileSync(descriptionPath, 'utf8')) as any;
        if (descriptionData.character_name) {
          characterName = descriptionData.character_name;
        }
        if (descriptionData.personality) {
          description = descriptionData.personality;
        }
      } catch (error) {
        logger.error(`[CharacterManifestRepository] Failed to parse character_description.yaml for ${characterId}:`, error);
      }
    }

    return {
      manifest_version: '1.0',
      character_id: characterId,
      character_name: characterName,
      description: description,
      version: '1.0.0',
    };
  }
}

// Singleton instance
const characterManifestRepository = new YamlCharacterManifestRepository();

export { characterManifestRepository, YamlCharacterManifestRepository };
