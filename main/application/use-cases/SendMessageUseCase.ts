import { SendMessageInput, ConversationOutput } from "../dtos/ConversationDTOs";
import { IChatHistoryRepository } from "main/domain/repositories/IChatHistoryRepository";
import { IRelationshipRepository } from "main/domain/repositories/IRelationshipRepository";
import { IUserRepository } from "main/domain/repositories/IUserRepository";
import { ICharacterRepository } from "main/domain/repositories/ICharacterRepository";

/**
 * Send Message Use Case
 *
 * Application layer use case for sending a message to character.
 * Orchestrates domain logic and infrastructure dependencies.
 */
export class SendMessageUseCase {
  constructor(
    private readonly chatHistoryRepo: IChatHistoryRepository,
    private readonly relationshipRepo: IRelationshipRepository,
    private readonly userRepo: IUserRepository,
    private readonly characterRepo: ICharacterRepository
  ) {}

  /**
   * Execute the use case
   *
   * Note: This is a placeholder implementation.
   * Full implementation requires LangGraph integration which will be done in Phase 3.
   */
  async execute(input: SendMessageInput, characterId: string): Promise<ConversationOutput> {
    // This will be implemented after LangChain is properly abstracted in Phase 3
    throw new Error("SendMessageUseCase: Not yet implemented. Will be completed in Phase 3 (LangChain Adapter)");
  }
}

/**
 * Factory function to create SendMessageUseCase with dependencies
 */
export function createSendMessageUseCase(
  chatHistoryRepo: IChatHistoryRepository,
  relationshipRepo: IRelationshipRepository,
  userRepo: IUserRepository,
  characterRepo: ICharacterRepository
): SendMessageUseCase {
  return new SendMessageUseCase(
    chatHistoryRepo,
    relationshipRepo,
    userRepo,
    characterRepo
  );
}