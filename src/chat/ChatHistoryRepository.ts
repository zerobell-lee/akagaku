import fs from 'fs';
import { ChatMessageHistory } from 'langchain/memory';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage, FunctionMessage, ToolMessage } from '@langchain/core/messages';
import { logger } from '../config/logger';

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
        data = fs.readFileSync(`data/chat/${character_name}/chat_history.json`, 'utf8');
    } catch (err) {
        data = '[]';
    }
    const messages: any[] = JSON.parse(data);
    const history = new ChatMessageHistory();
    messages.forEach((message: any) => {
        history.addMessage(reconstructFromLC(message));
    });
    return history;
}

export const updateChatHistory = async (character_name: string, history: ChatMessageHistory) => {
    const messages = await history.getMessages();
    const directoryPath = `data/chat/${character_name}`;
    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    fs.writeFile(`${directoryPath}/chat_history.json`, JSON.stringify(messages), (err) => {
        if (err) {
            logger.error('chat_history.json을 쓰는 중 오류 발생:', err);
        } else {
            logger.debug('chat_history.json이 성공적으로 업데이트되었습니다');
        }
    });
}
