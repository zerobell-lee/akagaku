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
   * DEPRECATED: Legacy structure (appearance.yaml in character root) is no longer supported
   */
  private getLegacySkinManifest(characterId: string): SkinManifest[] {
    logger.warn(`[SkinRepository] No skins directory found for ${characterId}. Please migrate to skins/ structure.`);
    return [];
  }

  /**
   * Get skin appearance configuration
   */
  getSkinAppearance(characterId: string, skinId: string): CharacterAppearance {
    const skinDir = this.getSkinDirectory(characterId, skinId);
    const appearancePath = path.join(skinDir, 'appearance.yaml');

    // Check skin appearance
    if (fs.existsSync(appearancePath)) {
      return yaml.load(fs.readFileSync(appearancePath, 'utf8')) as CharacterAppearance;
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

      // Validate thumbnail if specified
      if (manifest.thumbnail) {
        this.validateThumbnail(skinDir, manifest.thumbnail, 'skin', `${characterId}/${skinId}`);
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
   * Validate thumbnail file path and existence
   */
  private validateThumbnail(baseDir: string, thumbnailPath: string, type: 'skin' | 'character', identifier: string): void {
    // Check for path traversal attempts
    if (thumbnailPath.includes('..') || path.isAbsolute(thumbnailPath)) {
      logger.error(`[SkinRepository] Security: Path traversal attempt in ${type} thumbnail for ${identifier}: ${thumbnailPath}`);
      throw new Error(`Invalid thumbnail path: ${thumbnailPath}`);
    }

    // Resolve full path
    const fullPath = path.join(baseDir, thumbnailPath);

    // Check file existence
    if (!fs.existsSync(fullPath)) {
      logger.warn(`[SkinRepository] Thumbnail file not found for ${type} ${identifier}: ${fullPath}`);
      return; // Don't throw, just log warning
    }

    // Validate file extension
    const ext = path.extname(thumbnailPath).toLowerCase();
    const validExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
    if (!validExtensions.includes(ext)) {
      logger.warn(`[SkinRepository] Invalid thumbnail format for ${type} ${identifier}: ${ext} (expected: ${validExtensions.join(', ')})`);
      return;
    }

    // Check file size (max 500KB)
    const stats = fs.statSync(fullPath);
    const maxSize = 500 * 1024; // 500KB
    if (stats.size > maxSize) {
      logger.warn(`[SkinRepository] Thumbnail file too large for ${type} ${identifier}: ${stats.size} bytes (max: ${maxSize} bytes)`);
      // Don't throw, just log warning - large files can still load
    }

    logger.info(`[SkinRepository] Thumbnail validated for ${type} ${identifier}: ${thumbnailPath} (${stats.size} bytes)`);
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
   * Skin exists if skins/{skin_id}/ directory and manifest.yaml exist
   * appearance.yaml is optional (for non-interactive skins)
   */
  skinExists(characterId: string, skinId: string): boolean {
    const skinDir = this.getSkinDirectory(characterId, skinId);

    // Skin exists if directory and manifest.yaml exist
    if (fs.existsSync(skinDir)) {
      const manifestPath = path.join(skinDir, 'manifest.yaml');
      return fs.existsSync(manifestPath);
    }

    return false;
  }
}

// Singleton instance
export const skinRepository = new YamlSkinRepository();
