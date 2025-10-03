import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { LLMService } from "@shared/types";

/**
 * Chat History Summarizer Port
 *
 * Defines interface for conversation summarization service.
 * Infrastructure layer implements this using LangChain or other LLM providers.
 */
export interface IChatHistorySummarizer {
    /**
     * Summarizes old messages and returns updated chat history with summary inserted
     *
     * @param chatHistory - Current chat history
     * @param characterName - Character name for context
     * @param llmService - LLM service to use (openai, anthropic)
     * @param apiKey - API key for LLM service
     * @param modelName - Model name to use
     * @param enableLightweightModel - Whether to use lightweight model (gpt-4o-mini, claude-3-5-haiku-latest)
     * @returns Updated chat history with summary, or null if summarization was skipped
     */
    summarize(
        chatHistory: AkagakuChatHistory,
        characterName: string,
        llmService: LLMService,
        apiKey: string,
        modelName: string,
        enableLightweightModel: boolean
    ): Promise<AkagakuChatHistory | null>;
}
