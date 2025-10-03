import Store from 'electron-store'
import { configRepository } from '../config/ConfigRepository';
import { AkagakuBaseMessage, AkagakuSystemMessage, AkagakuUserMessage, AkagakuCharacterMessage } from "main/domain/message/AkagakuMessage";
import { parseDatetime } from '../utils/DatetimeStringUtils';
import { IChatHistoryRepository } from 'main/domain/repositories/IChatHistoryRepository';

let chatHistoryStore: Store | null = null;

const getChatHistoryStore = (): Store => {
  if (!chatHistoryStore) {
    chatHistoryStore = new Store({ name: 'chat_history' });
  }
  return chatHistoryStore;
};

export class AkagakuChatHistory {
  private messages: AkagakuBaseMessage[] = [];
  private windowSize: number = 30;

  constructor(messages: AkagakuBaseMessage[], windowSize: number) {
    this.windowSize = windowSize;
    this.messages = messages
  }

  addMessage(message: AkagakuBaseMessage) {
    this.messages.push(message);
    // No maximumSize limit - let archive rotation handle it
    return this;
  }

  getMessages(windowSize?: number): AkagakuBaseMessage[] {
    // Find last summary index
    let lastSummaryIndex = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].isSummary === true) {
        lastSummaryIndex = i;
        break;
      }
    }

    // LLM context: [last summary] + [messages after summary] (or all if no summary)
    let contextMessages: AkagakuBaseMessage[];
    if (lastSummaryIndex >= 0) {
      // Include last summary + all messages after it
      contextMessages = this.messages.slice(lastSummaryIndex);
    } else {
      // No summary yet, use recent messages only
      contextMessages = this.messages;
    }

    // Apply window size - but ensure summary is always included if it exists
    const targetSize = windowSize || this.windowSize;
    if (lastSummaryIndex >= 0 && contextMessages.length > targetSize) {
      // Always keep summary + most recent messages up to window size
      const summary = contextMessages[0];
      const recentMessages = contextMessages.slice(1).slice(-targetSize + 1);
      return [summary, ...recentMessages];
    }

    if (windowSize) {
      return contextMessages.slice(-windowSize)
    }
    return contextMessages.slice(-this.windowSize)
  }

  getAllMessagesInternal(): AkagakuBaseMessage[] {
    // Return ALL messages without any filtering (for saving to disk)
    return this.messages;
  }

  toChatLogs() {
    return this.messages.filter((message) => message.type !== 'system').map((message) => message.toChatLog());
  }
}

class ElectronStoreChatHistoryRepository implements IChatHistoryRepository {
  getChatHistory(character_name: string): AkagakuChatHistory {
    let rawMessages: any[] = [];
    const windowSize = configRepository.getConfig("chatHistoryLimit") as number || 20;
    try {
      const stored = getChatHistoryStore().get(`${character_name}/chat_history.json`);
      rawMessages = Array.isArray(stored) ? stored : [];
    } catch (err) {
    }

    const allMessages = rawMessages.map(msg => {
      const baseMsg = { ...msg, createdAt: parseDatetime(msg.createdAt) };
      switch (msg.type) {
        case 'system':
          return new AkagakuSystemMessage(baseMsg);
        case 'user':
          return new AkagakuUserMessage(baseMsg);
        case 'character':
          return new AkagakuCharacterMessage(baseMsg);
        default:
          console.warn(`Unknown message type: ${msg.type}`);
          return null;
      }
    }).filter(msg => msg !== null) as AkagakuBaseMessage[];

    // Load ALL messages into memory - don't filter by summary here
    // Summary filtering happens in getMessages() for LLM context only
    console.log(`[Performance] Loaded chat history: ${allMessages.length} total messages`);

    return new AkagakuChatHistory(allMessages, windowSize);
  }

  async updateChatHistory(character_name: string, history: AkagakuChatHistory): Promise<void> {
    // Save ALL messages including those before summary
    const allMessages = history.getAllMessagesInternal();

    // Archive rotation: keep only recent 1000 messages in current file
    const ARCHIVE_THRESHOLD = 1000;
    const KEEP_RECENT = 1000;

    if (allMessages.length > ARCHIVE_THRESHOLD) {
      const toArchive = allMessages.slice(0, allMessages.length - KEEP_RECENT);
      const toKeep = allMessages.slice(allMessages.length - KEEP_RECENT);

      // Generate archive key with date and sequence number
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const timeStr = now.toISOString().split('T')[1].replace(/:/g, '-').split('.')[0]; // HH-MM-SS
      const archiveKey = `${character_name}/archive_${dateStr}_${timeStr}.json`;

      getChatHistoryStore().set(archiveKey, toArchive);

      // Save recent messages to current file
      getChatHistoryStore().set(`${character_name}/chat_history.json`, toKeep);

      console.log(`[Archive] Archived ${toArchive.length} messages to ${archiveKey}, keeping ${toKeep.length} recent messages`);
    } else {
      getChatHistoryStore().set(`${character_name}/chat_history.json`, allMessages);
    }
  }

  getArchiveList(character_name: string): string[] {
    // Get all archive files for this character
    const allKeys = Object.keys(getChatHistoryStore().store);
    const archivePattern = `${character_name}/archive_`;
    return allKeys.filter(key => key.startsWith(archivePattern)).sort().reverse();
  }

  getArchive(archiveKey: string): AkagakuBaseMessage[] {
    try {
      const rawMessages = getChatHistoryStore().get(archiveKey) as any[];
      if (!Array.isArray(rawMessages)) return [];

      return rawMessages.map(msg => {
        const baseMsg = { ...msg, createdAt: parseDatetime(msg.createdAt) };
        switch (msg.type) {
          case 'system':
            return new AkagakuSystemMessage(baseMsg);
          case 'user':
            return new AkagakuUserMessage(baseMsg);
          case 'character':
            return new AkagakuCharacterMessage(baseMsg);
          default:
            return null;
        }
      }).filter(msg => msg !== null) as AkagakuBaseMessage[];
    } catch (err) {
      console.error(`Failed to load archive ${archiveKey}:`, err);
      return [];
    }
  }

  getAllMessages(character_name: string): AkagakuBaseMessage[] {
    // Load ALL messages but EXCLUDE summaries (for logs UI)
    let rawMessages: any[] = [];
    try {
      const stored = getChatHistoryStore().get(`${character_name}/chat_history.json`);
      rawMessages = Array.isArray(stored) ? stored : [];
    } catch (err) {
      console.error(`Failed to load messages for ${character_name}:`, err);
    }

    return rawMessages
      .filter(msg => !msg.isSummary)  // Exclude summary messages from logs
      .map(msg => {
        const baseMsg = { ...msg, createdAt: parseDatetime(msg.createdAt) };
        switch (msg.type) {
          case 'system':
            return new AkagakuSystemMessage(baseMsg);
          case 'user':
            return new AkagakuUserMessage(baseMsg);
          case 'character':
            return new AkagakuCharacterMessage(baseMsg);
          default:
            return null;
        }
      }).filter(msg => msg !== null) as AkagakuBaseMessage[];
  }
}

// Singleton instance
const chatHistoryRepository = new ElectronStoreChatHistoryRepository();

// Export singleton instance
export { chatHistoryRepository };

// Backward compatibility - keep old interface
export const getChatHistory = (character_name: string): AkagakuChatHistory => {
  return chatHistoryRepository.getChatHistory(character_name);
}

export const updateChatHistory = async (character_name: string, history: AkagakuChatHistory): Promise<void> => {
  return chatHistoryRepository.updateChatHistory(character_name, history);
}
