import Store from 'electron-store';
import { SQLiteDatabase } from '../SQLiteDatabase';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { configRepository } from '../../config/ConfigRepository';

interface ElectronStoreMessage {
  type: string;
  content: any;
  createdAt: string;
  isSummary?: boolean;
}

/**
 * Migration script to transfer chat history from electron-store to SQLite
 *
 * Steps:
 * 1. Read all chat_history.json and archive files from electron-store
 * 2. Backup original JSON files
 * 3. Insert messages into SQLite (separating summaries)
 * 4. Verify data integrity
 * 5. Set migration complete flag
 */
export class ChatHistoryMigration {
  private static MIGRATION_FLAG_KEY = 'chat_history_migrated_to_sqlite';

  /**
   * Check if migration has already been completed
   */
  static isCompleted(): boolean {
    try {
      return configRepository.getConfig(this.MIGRATION_FLAG_KEY) === true;
    } catch {
      return false;
    }
  }

  /**
   * Run migration if not already completed
   */
  static async run(): Promise<void> {
    if (this.isCompleted()) {
      console.log('[Migration] Chat history already migrated to SQLite');
      return;
    }

    console.log('[Migration] Starting chat history migration to SQLite...');

    try {
      const chatHistoryStore = new Store({ name: 'chat_history' });
      const allKeys = Object.keys(chatHistoryStore.store);

      // Backup original data
      this.backupOriginalData(chatHistoryStore);

      // Get unique character names
      const characters = new Set<string>();
      const archiveKeys: string[] = [];
      const currentHistoryKeys: string[] = [];

      for (const key of allKeys) {
        if (key.includes('/archive_')) {
          archiveKeys.push(key);
          const character = key.split('/')[0];
          characters.add(character);
        } else if (key.endsWith('/chat_history.json')) {
          currentHistoryKeys.push(key);
          const character = key.split('/')[0];
          characters.add(character);
        }
      }

      console.log(`[Migration] Found ${characters.size} characters to migrate`);

      // Migrate each character's messages
      const db = SQLiteDatabase.getInstance();
      let totalMessages = 0;
      let totalSummaries = 0;

      SQLiteDatabase.transaction((db) => {
        const insertMessage = db.prepare(`
          INSERT INTO messages (character, type, content, emoticon, created_at, created_timestamp)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertSummary = db.prepare(`
          INSERT INTO summaries (character, content, created_at, created_timestamp, message_count)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const character of Array.from(characters)) {
          console.log(`[Migration] Migrating ${character}...`);

          // Collect all messages from archives and current history
          const allMessages: ElectronStoreMessage[] = [];

          // Load archive messages (oldest first)
          const characterArchives = archiveKeys
            .filter(key => key.startsWith(`${character}/`))
            .sort(); // Sort by timestamp in filename

          for (const archiveKey of characterArchives) {
            const archiveData = chatHistoryStore.get(archiveKey);
            if (Array.isArray(archiveData)) {
              allMessages.push(...archiveData);
            }
          }

          // Load current history messages
          const currentKey = `${character}/chat_history.json`;
          const currentData = chatHistoryStore.get(currentKey);
          if (Array.isArray(currentData)) {
            allMessages.push(...currentData);
          }

          // Insert messages in chronological order
          for (const msg of allMessages) {
            const createdAt = new Date(msg.createdAt).toISOString();
            const timestamp = new Date(msg.createdAt).getTime();

            if (msg.type === 'system' && msg.isSummary === true) {
              // Insert as summary
              insertSummary.run(
                character,
                msg.content,
                createdAt,
                timestamp,
                null
              );
              totalSummaries++;
            } else {
              // Insert as regular message
              let content: string;
              let emoticon: string | null = null;

              if (msg.type === 'character' && typeof msg.content === 'object') {
                content = msg.content.message || msg.content;
                emoticon = msg.content.emoticon || null;
              } else {
                content = msg.content;
              }

              insertMessage.run(
                character,
                msg.type,
                content,
                emoticon,
                createdAt,
                timestamp
              );
              totalMessages++;
            }
          }

          console.log(`[Migration] ${character}: ${allMessages.length} messages migrated`);
        }
      });

      // Verify migration
      const verificationResult = this.verifyMigration(db, totalMessages, totalSummaries);
      if (!verificationResult.success) {
        throw new Error(`Migration verification failed: ${verificationResult.error}`);
      }

      // Set migration complete flag
      configRepository.setConfig(this.MIGRATION_FLAG_KEY, true);

      console.log(`[Migration] ✅ Successfully migrated ${totalMessages} messages and ${totalSummaries} summaries`);
      console.log('[Migration] Original JSON files backed up to .backup directory');

    } catch (error) {
      console.error('[Migration] ❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Backup original electron-store data
   */
  private static backupOriginalData(chatHistoryStore: Store): void {
    const backupDir = path.join(app.getPath('userData'), '.backup', `chat_history_${this.getTimestamp()}`);
    fs.mkdirSync(backupDir, { recursive: true });

    const storePath = chatHistoryStore.path;
    const backupPath = path.join(backupDir, 'chat_history.json');

    fs.copyFileSync(storePath, backupPath);
    console.log(`[Migration] Backed up original data to: ${backupDir}`);
  }

  /**
   * Verify migration data integrity
   */
  private static verifyMigration(db: any, expectedMessages: number, expectedSummaries: number): { success: boolean; error?: string } {
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get() as { count: number };
    const summaryCount = db.prepare('SELECT COUNT(*) as count FROM summaries').get() as { count: number };

    if (messageCount.count !== expectedMessages) {
      return {
        success: false,
        error: `Message count mismatch: expected ${expectedMessages}, got ${messageCount.count}`
      };
    }

    if (summaryCount.count !== expectedSummaries) {
      return {
        success: false,
        error: `Summary count mismatch: expected ${expectedSummaries}, got ${summaryCount.count}`
      };
    }

    console.log(`[Migration] Verification passed: ${messageCount.count} messages, ${summaryCount.count} summaries`);
    return { success: true };
  }

  /**
   * Get timestamp string for backup folder naming
   */
  private static getTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  }
}
