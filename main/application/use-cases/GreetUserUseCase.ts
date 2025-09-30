import { GreetUserInput, ConversationOutput } from "../dtos/ConversationDTOs";
import { IChatHistoryRepository } from "main/domain/repositories/IChatHistoryRepository";
import { ICharacterRepository } from "main/domain/repositories/ICharacterRepository";
import { IRelationshipRepository } from "main/domain/repositories/IRelationshipRepository";
import { IUserRepository } from "main/domain/repositories/IUserRepository";
import { ILLMService, IMessageParser, IMessageConverter } from "../ports/ILLMService";
import { AkagakuSystemMessage, AkagakuCharacterMessage } from "main/domain/message/AkagakuMessage";
import { Relationship } from "main/domain/entities/Relationship";

/**
 * Greet User Use Case
 *
 * Application layer use case for character greeting the user.
 * Handles first-time and returning user greetings.
 */
export class GreetUserUseCase {
  constructor(
    private readonly chatHistoryRepo: IChatHistoryRepository,
    private readonly characterRepo: ICharacterRepository,
    private readonly relationshipRepo: IRelationshipRepository,
    private readonly userRepo: IUserRepository,
    private readonly llmService: ILLMService,
    private readonly messageParser: IMessageParser,
    private readonly messageConverter: IMessageConverter
  ) {}

  async execute(input: GreetUserInput, characterId: string): Promise<ConversationOutput> {
    try {
      // 1. Get chat history and check if first time
      const chatHistory = this.chatHistoryRepo.getChatHistory(characterId);
      const isFirstTime = chatHistory.getMessages().length === 0;

      // 2. Get relationship
      const rawRelationship = this.relationshipRepo.getCharacterRelationships(characterId);
      const relationship = Relationship.fromRaw(rawRelationship);

      // 3. Get user info
      const userSetting = this.userRepo.getUserSetting();

      // 4. Get character setting
      const characterSetting = this.characterRepo.getCharacterSetting(characterId);

      // 5. Add greeting context system message
      const greetingContext = isFirstTime
        ? "This is the first meeting between you and the user. Greet them warmly and introduce yourself."
        : "The user has returned. Greet them as someone you know.";

      const systemMessage = new AkagakuSystemMessage({
        content: greetingContext,
        createdAt: new Date()
      });
      chatHistory.addMessage(systemMessage);

      // 6. Build LLM payload
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
        available_emoticons: characterSetting.available_emoticon,
        is_first_meeting: isFirstTime
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

      // 10. Persist chat history
      await this.chatHistoryRepo.updateChatHistory(characterId, chatHistory);

      // 11. Return result
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
      console.error("GreetUserUseCase error:", error);
      return {
        response: {
          message: "인사하는 데 오류가 발생했습니다.",
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
 * Factory function to create GreetUserUseCase with dependencies
 */
export function createGreetUserUseCase(
  chatHistoryRepo: IChatHistoryRepository,
  characterRepo: ICharacterRepository,
  relationshipRepo: IRelationshipRepository,
  userRepo: IUserRepository,
  llmService: ILLMService,
  messageParser: IMessageParser,
  messageConverter: IMessageConverter
): GreetUserUseCase {
  return new GreetUserUseCase(
    chatHistoryRepo,
    characterRepo,
    relationshipRepo,
    userRepo,
    llmService,
    messageParser,
    messageConverter
  );
}