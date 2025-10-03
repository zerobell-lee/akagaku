import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * Centralized data path management for Akagaku application
 * All user data files are stored under userData/ subdirectory
 */
export class DataPathManager {
  private static instance: DataPathManager;
  private userDataDir: string;

  private constructor() {
    const appDataPath = app.getPath('userData');
    this.userDataDir = path.join(appDataPath, 'userData');
    this.ensureDirectoryExists(this.userDataDir);
  }

  public static getInstance(): DataPathManager {
    if (!DataPathManager.instance) {
      DataPathManager.instance = new DataPathManager();
    }
    return DataPathManager.instance;
  }

  /**
   * Get the userData directory path
   */
  public getUserDataDir(): string {
    return this.userDataDir;
  }

  /**
   * Get path for a config file (json files)
   */
  public getConfigPath(filename: string): string {
    return path.join(this.userDataDir, filename);
  }

  /**
   * Get path for a database file
   */
  public getDatabasePath(filename: string): string {
    return path.join(this.userDataDir, filename);
  }

  /**
   * Get path for window state file
   */
  public getWindowStatePath(windowName: string): string {
    return path.join(this.userDataDir, `window-state-${windowName}.json`);
  }

  /**
   * Migrate a file from old location to new location
   * Returns true if migration was performed, false if file doesn't exist at old location
   */
  public migrateFile(oldPath: string, newPath: string): boolean {
    // If old file doesn't exist, no migration needed
    if (!fs.existsSync(oldPath)) {
      return false;
    }

    // If new file already exists, don't overwrite
    if (fs.existsSync(newPath)) {
      console.log(`[DataPathManager] Skipping migration: ${newPath} already exists`);
      return false;
    }

    try {
      // Ensure target directory exists
      const newDir = path.dirname(newPath);
      this.ensureDirectoryExists(newDir);

      // Copy file to new location
      fs.copyFileSync(oldPath, newPath);
      console.log(`[DataPathManager] ✓ Migrated: ${path.basename(oldPath)} -> ${newPath}`);

      // Remove old file after successful migration
      fs.unlinkSync(oldPath);
      console.log(`[DataPathManager] ✓ Removed old file: ${oldPath}`);

      return true;
    } catch (error) {
      console.error(`[DataPathManager] Failed to migrate ${oldPath}:`, error);
      return false;
    }
  }

  /**
   * Get old path for migration (before userData directory structure)
   */
  public getOldPath(filename: string): string {
    const appDataPath = app.getPath('userData');
    return path.join(appDataPath, filename);
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`[DataPathManager] Created directory: ${dirPath}`);
    }
  }

  /**
   * Auto-migrate all common data files from old structure to new structure
   * Should be called once during app initialization
   */
  public autoMigrateDataFiles(): void {
    console.log('[DataPathManager] Starting auto-migration...');

    const filesToMigrate = [
      'config.json',
      'relationship.json',
      'tool_config.json',
      'akagaku.db',
      'akagaku.db-shm',
      'akagaku.db-wal',
    ];

    // Migrate window state files
    const windowNames = ['main', 'config', 'logs', 'speech-bubble', 'user-chat-input', 'character-info'];
    for (const name of windowNames) {
      filesToMigrate.push(`window-state-${name}.json`);
    }

    let migratedCount = 0;
    for (const filename of filesToMigrate) {
      const oldPath = this.getOldPath(filename);
      const newPath = this.getConfigPath(filename);
      if (this.migrateFile(oldPath, newPath)) {
        migratedCount++;
      }
    }

    if (migratedCount > 0) {
      console.log(`[DataPathManager] ✓ Auto-migration completed: ${migratedCount} files migrated`);
    } else {
      console.log('[DataPathManager] No files to migrate');
    }
  }
}

// Export singleton instance
export const dataPathManager = DataPathManager.getInstance();
