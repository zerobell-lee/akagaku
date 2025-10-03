import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { AkagakuBaseMessage } from "main/domain/message/AkagakuMessage";

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

  /**
   * Get recent raw messages regardless of summary state
   * Excludes system messages, returns actual conversation messages
   *
   * @param characterName - Character identifier
   * @param limit - Number of recent messages to retrieve
   * @returns Array of recent messages (user and character only)
   */
  getRecentRawMessages(characterName: string, limit: number): AkagakuBaseMessage[];
}