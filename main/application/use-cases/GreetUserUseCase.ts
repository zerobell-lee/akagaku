import { GreetUserInput, ConversationOutput } from "../dtos/ConversationDTOs";
import { IChatHistoryRepository } from "main/domain/repositories/IChatHistoryRepository";
import { ICharacterRepository } from "main/domain/repositories/ICharacterRepository";

/**
 * Greet User Use Case
 *
 * Application layer use case for character greeting the user.
 * Handles first-time and returning user greetings.
 */
export class GreetUserUseCase {
  constructor(
    private readonly chatHistoryRepo: IChatHistoryRepository,
    private readonly characterRepo: ICharacterRepository
  ) {}

  /**
   * Execute the use case
   *
   * Note: This is a placeholder implementation.
   * Full implementation requires LangGraph integration which will be done in Phase 3.
   */
  async execute(input: GreetUserInput, characterId: string): Promise<ConversationOutput> {
    // Check if first time
    const chatHistory = this.chatHistoryRepo.getChatHistory(characterId);
    const isFirstTime = chatHistory.getMessages().length === 0;

    // This will be implemented after LangChain is properly abstracted in Phase 3
    throw new Error("GreetUserUseCase: Not yet implemented. Will be completed in Phase 3 (LangChain Adapter)");
  }
}

/**
 * Factory function to create GreetUserUseCase with dependencies
 */
export function createGreetUserUseCase(
  chatHistoryRepo: IChatHistoryRepository,
  characterRepo: ICharacterRepository
): GreetUserUseCase {
  return new GreetUserUseCase(chatHistoryRepo, characterRepo);
}