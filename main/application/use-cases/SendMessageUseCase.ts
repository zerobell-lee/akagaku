import { SendMessageInput, ConversationOutput } from "../dtos/ConversationDTOs";
import { IChatHistoryRepository } from "main/domain/repositories/IChatHistoryRepository";
import { IRelationshipRepository } from "main/domain/repositories/IRelationshipRepository";
import { IUserRepository } from "main/domain/repositories/IUserRepository";
import { ICharacterRepository } from "main/domain/repositories/ICharacterRepository";
import { ILLMService, IMessageParser, IMessageConverter } from "../ports/ILLMService";
import { AkagakuUserMessage, AkagakuCharacterMessage } from "main/domain/message/AkagakuMessage";
import { Relationship } from "main/domain/entities/Relationship";
import { Attitude } from "main/domain/value-objects/Attitude";

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
    private readonly characterRepo: ICharacterRepository,
    private readonly llmService: ILLMService,
    private readonly messageParser: IMessageParser,
    private readonly messageConverter: IMessageConverter
  ) {}

  async execute(input: SendMessageInput, characterId: string): Promise<ConversationOutput> {
    try {
      // 1. Get chat history
      const chatHistory = this.chatHistoryRepo.getChatHistory(characterId);

      // 2. Get relationship
      const rawRelationship = this.relationshipRepo.getCharacterRelationships(characterId);
      let relationship = Relationship.fromRaw(rawRelationship);

      // 3. Get user info
      const userSetting = this.userRepo.getUserSetting();

      // 4. Get character setting
      const characterSetting = this.characterRepo.getCharacterSetting(characterId);

      // 5. Add user message to history
      const userMessage = new AkagakuUserMessage({
        content: input.message,
        createdAt: new Date()
      });
      chatHistory.addMessage(userMessage);

      // 6. Build LLM payload with conversation context
      const messages = chatHistory.getMessages().map(msg =>
        this.messageConverter.convertToLangChainMessage(msg)
      );

      const payload = {
        messages,
        character_name: characterSetting.character_name,
        character_description: characterSetting.description,
        user_name: userSetting.name,
        user_occupation: userSetting.occupation,
        user_location: userSetting.location,
        affection: relationship.getAffection().getValue(),
        attitude: relationship.getAttitude().getValue(),
        available_emoticons: characterSetting.available_emoticon
      };

      // 7. Invoke LLM
      const llmResult = await this.llmService.invoke(payload);

      // 8. Parse response
      const parsed = this.messageParser.parseGhostResponse(llmResult.final_response);

      // 9. Create character message
      const characterMessage = new AkagakuCharacterMessage({
        content: parsed.response,
        characterName: characterSetting.character_name,
        emoticon: parsed.emoticon,
        createdAt: new Date()
      });
      chatHistory.addMessage(characterMessage);

      // 10. Update relationship
      const updatedAffection = relationship.getAffection().add(parsed.add_affection);
      const newAttitudeString = this.characterRepo.calcAttitude(
        characterId,
        updatedAffection.getValue()
      );
      const newAttitude = Attitude.create(newAttitudeString);
      relationship = relationship.update(parsed.add_affection, newAttitude);

      // 11. Persist updates
      await this.chatHistoryRepo.updateChatHistory(characterId, chatHistory);
      await this.relationshipRepo.updateCharacterRelationships(
        characterId,
        relationship.getAffection().getValue(),
        relationship.getAttitude().getValue()
      );

      // 12. Return result
      return {
        response: {
          message: parsed.response,
          emoticon: parsed.emoticon,
          affection: relationship.getAffection().getValue(),
          attitude: relationship.getAttitude().getValue()
        },
        success: true
      };
    } catch (error) {
      console.error("SendMessageUseCase error:", error);
      return {
        response: {
          message: "오류가 발생했습니다.",
          emoticon: "neutral",
          affection: 50,
          attitude: "neutral"
        },
        success: false,
        errorType: error.name,
        errorMessage: error.message
      };
    }
  }
}

/**
 * Factory function to create SendMessageUseCase with dependencies
 */
export function createSendMessageUseCase(
  chatHistoryRepo: IChatHistoryRepository,
  relationshipRepo: IRelationshipRepository,
  userRepo: IUserRepository,
  characterRepo: ICharacterRepository,
  llmService: ILLMService,
  messageParser: IMessageParser,
  messageConverter: IMessageConverter
): SendMessageUseCase {
  return new SendMessageUseCase(
    chatHistoryRepo,
    relationshipRepo,
    userRepo,
    characterRepo,
    llmService,
    messageParser,
    messageConverter
  );
}