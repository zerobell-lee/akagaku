import { ChatMessageHistory } from 'langchain/memory';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, FunctionMessage, ToolMessage, trimMessages } from '@langchain/core/messages';
import { logger } from '../config/logger';
import Store from 'electron-store'

const chatHistoryStore = new Store({ name: 'chat_history' });

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

export const getChatHistory = async (character_name: string) => {
    let data;
    try {
        data = chatHistoryStore.get(`${character_name}/chat_history.json`) || [];
    } catch (err) {
        data = [];
    }
    const messages: any[] = data;
    const history = new ChatMessageHistory();
    messages.forEach((message: any) => {
        history.addMessage(reconstructFromLC(message));
    });
    
    return history;
}

export const updateChatHistory = async (character_name: string, history: ChatMessageHistory) => {
    const messages = await history.getMessages();
    chatHistoryStore.set(`${character_name}/chat_history.json`, messages);
}
