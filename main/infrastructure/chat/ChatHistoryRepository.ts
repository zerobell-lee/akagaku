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

    const messages = rawMessages.map(msg => {
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

    return new AkagakuChatHistory(messages, windowSize);
  }

  async updateChatHistory(character_name: string, history: AkagakuChatHistory): Promise<void> {
    const messages = history.getMessages();
    chatHistoryStore.set(`${character_name}/chat_history.json`, messages);
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
