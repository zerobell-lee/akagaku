import { ChatMessageHistory } from 'langchain/memory';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, FunctionMessage, ToolMessage, trimMessages } from '@langchain/core/messages';
import { logger } from '../config/logger';
import Store from 'electron-store'
import { configRepository } from '../config/ConfigRepository';

const chatHistoryStore = new Store({ name: 'chat_history' });

export class AkagakuChatHistory {
  private messages: { timestamp: string, message: BaseMessage }[] = [];
  private maximumSize: number

  constructor(messages: { timestamp: string, message: BaseMessage }[], maximumSize: number) {
    this.messages = messages
    this.maximumSize = maximumSize;
  }

  addMessage(message: { timestamp: string, message: BaseMessage }) {
    this.messages.push(message);
    if (this.messages.length > this.maximumSize) {
      this.messages.shift();
    }
  }

  toChatMessageHistory(trimSystemMessage: boolean = false) {
    return new ChatMessageHistory(this.messages.filter((message) => !trimSystemMessage || !(message.message instanceof SystemMessage)).map((message) => message.message));
  }

  getMessages(): {timestamp: string, message: BaseMessage}[] {
    return this.messages;
  }

  toChatLogs() {
    return this.messages.filter((message) => message.message.getType() !== 'system').map((message) => {
      const role = message.message.getType() === 'human' ? "user" : "character"
      let content = (message.message.content as string).slice((message.message.content as string).indexOf('|') + 1)
      if (message.message.getType() === 'ai') {
        const parsedResponse = JSON.parse(message.message.content as string)
        content = parsedResponse.message
      }
      return {
        timestamp: message.timestamp,
        role: role,
        content: content
      }
    });
  }
}

// 복원 함수
const reconstructFromLC = (msg: any): BaseMessage => {
  const type = msg.id[msg.id.length - 1]; // "HumanMessage" 등
  const content = msg.kwargs.content;
  const kwargs = msg.kwargs;

  switch (type) {
    case "HumanMessage":
      return new HumanMessage(kwargs);
    case "AIMessage":
      return new AIMessage(kwargs);
    case "SystemMessage":
      return new SystemMessage(kwargs);
    case "FunctionMessage":
      return new FunctionMessage(kwargs);
    case "ToolMessage":
      return new ToolMessage(kwargs);
    default:
      throw new Error(`Unknown message type: ${type}`);
  }
}

export const getChatHistory = (character_name: string): AkagakuChatHistory => {
  let messages: { timestamp: string, message: BaseMessage }[] = [];
  const maximumSize = configRepository.getConfig("chatHistoryLimit") as number || 100;
  try {
    messages = chatHistoryStore.get(`${character_name}/chat_history.json`) as { timestamp: string, message: BaseMessage }[] || [];
  } catch (err) {
  }
  console.log(messages)
  messages = messages.map((message) => ({timestamp: message.timestamp, message: reconstructFromLC(message.message)}))
  return new AkagakuChatHistory(messages, maximumSize);
}

export const updateChatHistory = async (character_name: string, history: AkagakuChatHistory) => {
  const messages = history.getMessages();
  chatHistoryStore.set(`${character_name}/chat_history.json`, messages);
}
