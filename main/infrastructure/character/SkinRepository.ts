import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { ISkinRepository } from '../../domain/repositories/ISkinRepository';
import { SkinManifest, CharacterAppearance } from '@shared/types';
import { logger } from '../config/logger';

const getDataDirectory = () => path.join(app.getAppPath(), 'data');

class YamlSkinRepository implements ISkinRepository {
  private store: Store;
  private readonly ACTIVE_SKIN_KEY = 'activeSkins';

  constructor() {
    this.store = new Store();
  }

  /**
   * Get skins directory path for a character
   */
  private getSkinsDirectory(characterId: string): string {
    return path.join(getDataDirectory(), `character/${characterId}/skins`);
  }

  /**
   * Get skin directory path
   */
  private getSkinDirectory(characterId: string, skinId: string): string {
    return path.join(this.getSkinsDirectory(characterId), skinId);
  }

  /**
   * Get all available skins for a character
   */
  getAvailableSkins(characterId: string): SkinManifest[] {
    const skinsDir = this.getSkinsDirectory(characterId);

    // Check if skins directory exists
    if (!fs.existsSync(skinsDir)) {
      logger.warn(`[SkinRepository] Skins directory not found for character ${characterId}, using legacy structure`);
      return this.getLegacySkinManifest(characterId);
    }

    const skins: SkinManifest[] = [];
    const skinDirs = fs.readdirSync(skinsDir, { withFileTypes: true });

    for (const dirent of skinDirs) {
      if (dirent.isDirectory()) {
        try {
          const manifest = this.getSkinManifest(characterId, dirent.name);
          skins.push(manifest);
        } catch (error) {
          logger.error(`[SkinRepository] Failed to load manifest for skin ${dirent.name}:`, error);
        }
      }
    }

    return skins;
  }

  /**
   * Get legacy skin manifest (backward compatibility)
   */
  private getLegacySkinManifest(characterId: string): SkinManifest[] {
    const legacyAppearancePath = path.join(getDataDirectory(), `character/${characterId}/appearance.yaml`);

    if (fs.existsSync(legacyAppearancePath)) {
      return [{
        manifest_version: '1.0',
        skin_id: 'default',
        skin_name: 'Default Appearance',
        description: 'Standard everyday outfit',
        version: '1.0.0'
      }];
    }

    return [];
  }

  /**
   * Get skin appearance configuration
   */
  getSkinAppearance(characterId: string, skinId: string): CharacterAppearance {
    const skinDir = this.getSkinDirectory(characterId, skinId);
    const appearancePath = path.join(skinDir, 'appearance.yaml');

    // Check new structure
    if (fs.existsSync(appearancePath)) {
      return yaml.load(fs.readFileSync(appearancePath, 'utf8')) as CharacterAppearance;
    }

    // Fallback to legacy structure for default skin
    if (skinId === 'default') {
      const legacyPath = path.join(getDataDirectory(), `character/${characterId}/appearance.yaml`);
      if (fs.existsSync(legacyPath)) {
        logger.warn(`[SkinRepository] Using legacy appearance for character ${characterId}`);
        return yaml.load(fs.readFileSync(legacyPath, 'utf8')) as CharacterAppearance;
      }
    }

    throw new Error(`Appearance not found for character ${characterId}, skin ${skinId}`);
  }

  /**
   * Get skin manifest metadata
   */
  getSkinManifest(characterId: string, skinId: string): SkinManifest {
    const skinDir = this.getSkinDirectory(characterId, skinId);
    const manifestPath = path.join(skinDir, 'manifest.yaml');

    if (fs.existsSync(manifestPath)) {
      const manifest = yaml.load(fs.readFileSync(manifestPath, 'utf8')) as SkinManifest;
      // Ensure manifest_version is set (default to "1.0" for backward compatibility)
      if (!manifest.manifest_version) {
        manifest.manifest_version = '1.0';
      }
      return manifest;
    }

    // If manifest doesn't exist but it's default skin, return default manifest
    if (skinId === 'default' && this.skinExists(characterId, skinId)) {
      logger.warn(`[SkinRepository] No manifest found for default skin, using fallback`);
      return {
        manifest_version: '1.0',
        skin_id: 'default',
        skin_name: 'Default Appearance',
        description: 'Standard everyday outfit',
        version: '1.0.0'
      };
    }

    throw new Error(`Manifest not found for character ${characterId}, skin ${skinId}`);
  }

  /**
   * Get currently active skin ID for a character
   */
  getActiveSkin(characterId: string): string {
    const activeSkins = this.store.get(this.ACTIVE_SKIN_KEY, {}) as Record<string, string>;
    return activeSkins[characterId] || 'default';
  }

  /**
   * Set active skin for a character
   */
  setActiveSkin(characterId: string, skinId: string): void {
    if (!this.skinExists(characterId, skinId)) {
      throw new Error(`Skin ${skinId} does not exist for character ${characterId}`);
    }

    const activeSkins = this.store.get(this.ACTIVE_SKIN_KEY, {}) as Record<string, string>;
    activeSkins[characterId] = skinId;
    this.store.set(this.ACTIVE_SKIN_KEY, activeSkins);

    logger.info(`[SkinRepository] Active skin for ${characterId} set to ${skinId}`);
  }

  /**
   * Check if skin exists
   */
  skinExists(characterId: string, skinId: string): boolean {
    const skinDir = this.getSkinDirectory(characterId, skinId);

    // Check new structure
    if (fs.existsSync(skinDir)) {
      const appearancePath = path.join(skinDir, 'appearance.yaml');
      return fs.existsSync(appearancePath);
    }

    // Check legacy structure for default skin
    if (skinId === 'default') {
      const legacyPath = path.join(getDataDirectory(), `character/${characterId}/appearance.yaml`);
      return fs.existsSync(legacyPath);
    }

    return false;
  }
}

// Singleton instance
export const skinRepository = new YamlSkinRepository();
