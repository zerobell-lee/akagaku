import { IChatHistoryRepository } from 'main/domain/repositories/IChatHistoryRepository';
import { AkagakuBaseMessage, AkagakuSystemMessage, AkagakuUserMessage, AkagakuCharacterMessage } from 'main/domain/message/AkagakuMessage';
import { AkagakuChatHistory } from './ChatHistoryRepository';
import { SQLiteDatabase } from '../database/SQLiteDatabase';
import { configRepository } from '../config/ConfigRepository';

interface MessageRow {
  id: number;
  character: string;
  type: string;
  content: string;
  emoticon: string | null;
  created_at: string;
  created_timestamp: number;
}

interface SummaryRow {
  id: number;
  character: string;
  content: string;
  created_at: string;
  created_timestamp: number;
  message_count: number | null;
}

/**
 * SQLite-based Chat History Repository
 *
 * Stores messages and summaries in separate tables for optimized retrieval
 */
export class SQLiteChatHistoryRepository implements IChatHistoryRepository {
  getChatHistory(character_name: string): AkagakuChatHistory {
    const db = SQLiteDatabase.getInstance();
    const windowSize = configRepository.getConfig("chatHistoryLimit") as number || 20;

    // 1. Get last summary for this character
    const lastSummary = db.prepare(`
      SELECT * FROM summaries
      WHERE character = ?
      ORDER BY created_timestamp DESC
      LIMIT 1
    `).get(character_name) as SummaryRow | undefined;

    // 2. Get messages after last summary (or all if no summary)
    let messages: AkagakuBaseMessage[] = [];

    if (lastSummary) {
      // Add summary as first message
      messages.push(new AkagakuSystemMessage({
        content: lastSummary.content,
        createdAt: new Date(lastSummary.created_at),
        isSummary: true
      }));

      // Get messages after summary
      const rows = db.prepare(`
        SELECT * FROM messages
        WHERE character = ? AND created_timestamp > ?
        ORDER BY created_timestamp ASC
      `).all(character_name, lastSummary.created_timestamp) as MessageRow[];

      messages.push(...rows.map(row => this.rowToMessage(row)));
    } else {
      // No summary, get all messages
      const rows = db.prepare(`
        SELECT * FROM messages
        WHERE character = ?
        ORDER BY created_timestamp ASC
      `).all(character_name) as MessageRow[];

      messages = rows.map(row => this.rowToMessage(row));
    }

    console.log(`[SQLiteChatHistory] Loaded ${messages.length} messages for ${character_name}`);
    return new AkagakuChatHistory(messages, windowSize);
  }

  async updateChatHistory(character_name: string, history: AkagakuChatHistory): Promise<void> {
    const db = SQLiteDatabase.getInstance();
    const allMessages = history.getAllMessagesInternal();

    if (allMessages.length === 0) {
      return; // No messages to save
    }

    // Get last message timestamp from DB to determine what's new
    const lastMessageRow = db.prepare(`
      SELECT MAX(created_timestamp) as last_timestamp FROM (
        SELECT created_timestamp FROM messages WHERE character = ?
        UNION ALL
        SELECT created_timestamp FROM summaries WHERE character = ?
      )
    `).get(character_name, character_name) as { last_timestamp: number | null };

    const lastTimestamp = lastMessageRow.last_timestamp || 0;

    // Filter messages newer than last timestamp
    const newMessages = allMessages.filter(msg => msg.createdAt.getTime() > lastTimestamp);

    if (newMessages.length === 0) {
      return; // No new messages to save
    }

    // Insert new messages in a transaction
    SQLiteDatabase.transaction((db) => {
      const insertMessage = db.prepare(`
        INSERT INTO messages (character, type, content, emoticon, created_at, created_timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const insertSummary = db.prepare(`
        INSERT INTO summaries (character, content, created_at, created_timestamp, message_count)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const message of newMessages) {
        const createdAt = message.createdAt.toISOString();
        const timestamp = message.createdAt.getTime();

        if (message.type === 'system' && message.isSummary) {
          // Insert into summaries table
          insertSummary.run(
            character_name,
            message.content,
            createdAt,
            timestamp,
            null // message_count can be calculated later if needed
          );
        } else {
          // Insert into messages table
          let content: string;
          let emoticon: string | null = null;

          if (message.type === 'character') {
            const characterMsg = message as AkagakuCharacterMessage;
            content = characterMsg.content.message;
            emoticon = characterMsg.content.emoticon || null;
          } else {
            content = message.content;
          }

          insertMessage.run(
            character_name,
            message.type,
            content,
            emoticon,
            createdAt,
            timestamp
          );
        }
      }
    });

    console.log(`[SQLiteChatHistory] Saved ${newMessages.length} new messages for ${character_name}`);
  }

  getArchiveList(character_name: string): string[] {
    // SQLite doesn't use archive files - all messages are in DB
    // Return empty array for backward compatibility
    return [];
  }

  getArchive(archiveKey: string): AkagakuBaseMessage[] {
    // SQLite doesn't use archive files
    // Return empty array for backward compatibility
    return [];
  }

  getAllMessages(character_name: string): AkagakuBaseMessage[] {
    const db = SQLiteDatabase.getInstance();

    // Get all messages (excluding summaries) for UI display
    const rows = db.prepare(`
      SELECT * FROM messages
      WHERE character = ?
      ORDER BY created_timestamp ASC
    `).all(character_name) as MessageRow[];

    console.log(`[SQLiteChatHistory] getAllMessages for ${character_name}: found ${rows.length} messages in DB`);

    return rows.map(row => this.rowToMessage(row));
  }

  /**
   * Get recent raw messages regardless of summary state
   * Excludes system messages, returns actual conversation messages
   */
  getRecentRawMessages(character_name: string, limit: number): AkagakuBaseMessage[] {
    const db = SQLiteDatabase.getInstance();

    // Get recent messages from DB, excluding system messages
    const rows = db.prepare(`
      SELECT * FROM messages
      WHERE character = ? AND type != 'system'
      ORDER BY created_timestamp DESC
      LIMIT ?
    `).all(character_name, limit) as MessageRow[];

    // Reverse to get chronological order (oldest to newest)
    return rows.reverse().map(row => this.rowToMessage(row));
  }

  /**
   * Convert database row to AkagakuBaseMessage
   */
  private rowToMessage(row: MessageRow): AkagakuBaseMessage {
    const createdAt = new Date(row.created_at);

    switch (row.type) {
      case 'system':
        return new AkagakuSystemMessage({
          content: row.content,
          createdAt,
          isSummary: false
        });
      case 'user':
        return new AkagakuUserMessage({
          content: row.content,
          createdAt
        });
      case 'character':
        return new AkagakuCharacterMessage({
          content: {
            message: row.content,
            emoticon: row.emoticon || '',
            add_affection: 0  // Not stored in DB, default to 0
          },
          createdAt
        });
      default:
        throw new Error(`Unknown message type: ${row.type}`);
    }
  }
}
