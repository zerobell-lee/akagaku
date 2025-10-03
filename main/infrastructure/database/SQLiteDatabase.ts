import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDataDirectory } from '../config/ConfigRepository';

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
    const schemaPath = path.join(getDataDirectory(), 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

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
