import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";

/**
 * Chat History Repository Interface
 *
 * Domain layer interface for chat history persistence.
 * Implementation should be in infrastructure layer.
 */
export interface IChatHistoryRepository {
  /**
   * Retrieve chat history for a character
   */
  getChatHistory(characterName: string): AkagakuChatHistory;

  /**
   * Persist chat history for a character
   */
  updateChatHistory(characterName: string, history: AkagakuChatHistory): Promise<void>;
}