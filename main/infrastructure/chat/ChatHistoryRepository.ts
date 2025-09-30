import Store from 'electron-store'
import { configRepository } from '../config/ConfigRepository';
import { AkagakuBaseMessage, AkagakuSystemMessage, AkagakuUserMessage, AkagakuCharacterMessage } from "main/domain/message/AkagakuMessage";
import { parseDatetime } from '../utils/DatetimeStringUtils';
import { IChatHistoryRepository } from 'main/domain/repositories/IChatHistoryRepository';

const chatHistoryStore = new Store({ name: 'chat_history' });

export class AkagakuChatHistory {
  private messages: AkagakuBaseMessage[] = [];
  private maximumSize: number = 100;
  private windowSize: number = 30;

  constructor(messages: AkagakuBaseMessage[], windowSize: number) {
    this.windowSize = windowSize;
    this.messages = messages
  }

  addMessage(message: AkagakuBaseMessage) {
    this.messages.push(message);
    if (this.messages.length > this.maximumSize) {
      this.messages.shift();
    }
    return this;
  }

  getMessages(windowSize?: number): AkagakuBaseMessage[] {
    if (windowSize) {
      return this.messages.slice(-windowSize)
    }
    return this.messages.slice(-this.windowSize)
  }

  toChatLogs() {
    return this.messages.filter((message) => message.type !== 'system').map((message) => message.toChatLog());
  }
}

class ElectronStoreChatHistoryRepository implements IChatHistoryRepository {
  getChatHistory(character_name: string): AkagakuChatHistory {
    let rawMessages: any[] = [];
    const windowSize = configRepository.getConfig("chatHistoryLimit") as number || 100;
    try {
      const stored = chatHistoryStore.get(`${character_name}/chat_history.json`);
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

    // Find last summary message index
    let lastSummaryIndex = -1;
    for (let i = allMessages.length - 1; i >= 0; i--) {
      if (allMessages[i].isSummary === true) {
        lastSummaryIndex = i;
        break;
      }
    }

    // Use messages from last summary onwards (or all if no summary)
    const contextMessages = lastSummaryIndex >= 0
      ? allMessages.slice(lastSummaryIndex)
      : allMessages;

    console.log(`[Performance] Loaded chat history: ${allMessages.length} total, ${contextMessages.length} in context (summary at index ${lastSummaryIndex})`);

    return new AkagakuChatHistory(contextMessages, windowSize);
  }

  async updateChatHistory(character_name: string, history: AkagakuChatHistory): Promise<void> {
    // Save all messages (not just windowSize) to preserve full history
    const allMessages = history.getMessages(999);

    // Archive rotation: keep only recent 1000 messages in current file
    const ARCHIVE_THRESHOLD = 1000;
    const KEEP_RECENT = 500;

    if (allMessages.length > ARCHIVE_THRESHOLD) {
      const toArchive = allMessages.slice(0, allMessages.length - KEEP_RECENT);
      const toKeep = allMessages.slice(allMessages.length - KEEP_RECENT);

      // Save archived messages with timestamp
      const archiveKey = `${character_name}/archive_${Date.now()}.json`;
      chatHistoryStore.set(archiveKey, toArchive);

      // Save recent messages to current file
      chatHistoryStore.set(`${character_name}/chat_history.json`, toKeep);

      console.log(`[Archive] Archived ${toArchive.length} messages to ${archiveKey}, keeping ${toKeep.length} recent messages`);
    } else {
      chatHistoryStore.set(`${character_name}/chat_history.json`, allMessages);
    }
  }

  getArchiveList(character_name: string): string[] {
    // Get all archive files for this character
    const allKeys = Object.keys(chatHistoryStore.store);
    const archivePattern = `${character_name}/archive_`;
    return allKeys.filter(key => key.startsWith(archivePattern)).sort().reverse();
  }

  getArchive(archiveKey: string): AkagakuBaseMessage[] {
    try {
      const rawMessages = chatHistoryStore.get(archiveKey) as any[];
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
}

// Singleton instance
const chatHistoryRepository = new ElectronStoreChatHistoryRepository();

// Backward compatibility - keep old interface
export const getChatHistory = (character_name: string): AkagakuChatHistory => {
  return chatHistoryRepository.getChatHistory(character_name);
}

export const updateChatHistory = async (character_name: string, history: AkagakuChatHistory): Promise<void> => {
  return chatHistoryRepository.updateChatHistory(character_name, history);
}

export { chatHistoryRepository };
