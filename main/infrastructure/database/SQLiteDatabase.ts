import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';

/**
 * SQLite Database Connection Manager
 *
 * Provides singleton database instance and transaction helpers
 */
export class SQLiteDatabase {
  private static instance: Database.Database | null = null;

  /**
   * Get database instance (singleton)
   */
  static getInstance(): Database.Database {
    if (!SQLiteDatabase.instance) {
      const dbPath = path.join(app.getPath('userData'), 'akagaku.db');
      console.log(`[SQLiteDatabase] Initializing database at: ${dbPath}`);

      SQLiteDatabase.instance = new Database(dbPath);
      SQLiteDatabase.instance.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency

      SQLiteDatabase.initializeSchema();
    }
    return SQLiteDatabase.instance;
  }

  /**
   * Initialize database schema
   */
  private static initializeSchema(): void {
    const schema = `
      -- Chat messages table (excluding summaries)
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        emoticon TEXT,
        created_at TEXT NOT NULL,
        created_timestamp INTEGER NOT NULL
      );

      -- Summary table (separate from regular messages)
      CREATE TABLE IF NOT EXISTS summaries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        character TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_timestamp INTEGER NOT NULL,
        message_count INTEGER,
        UNIQUE(character, created_timestamp)
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_messages_character ON messages(character);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(character, created_timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_summaries_character ON summaries(character);
      CREATE INDEX IF NOT EXISTS idx_summaries_timestamp ON summaries(character, created_timestamp DESC);
    `;

    SQLiteDatabase.instance!.exec(schema);
    console.log('[SQLiteDatabase] Schema initialized');
  }

  /**
   * Execute statements in a transaction
   */
  static transaction<T>(fn: (db: Database.Database) => T): T {
    const db = SQLiteDatabase.getInstance();
    const transaction = db.transaction(fn);
    return transaction(db);
  }

  /**
   * Close database connection (for cleanup)
   */
  static close(): void {
    if (SQLiteDatabase.instance) {
      SQLiteDatabase.instance.close();
      SQLiteDatabase.instance = null;
      console.log('[SQLiteDatabase] Database connection closed');
    }
  }
}
