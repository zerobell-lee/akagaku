import { LLMService } from "@shared/types";

/**
 * Chat History Summarizer Port
 *
 * Defines interface for conversation summarization service.
 * Infrastructure layer implements this using LangChain or other LLM providers.
 * Works directly with SQLite database for efficient message management.
 */
export interface IChatHistorySummarizer {
    /**
     * Summarizes old messages directly in SQLite database
     *
     * This method:
     * 1. Queries unsummarized messages from SQLite
     * 2. Generates summary using LLM
     * 3. Inserts summary with timestamp of last summarized message
     *
     * Note: Original messages are preserved in database for full conversation history.
     * Summary is used only for LLM context compression to reduce token usage.
     *
     * @param characterName - Character identifier for message retrieval
     * @param llmService - LLM service to use (openai, anthropic)
     * @param apiKey - API key for LLM service
     * @param modelName - Model name to use
     * @param enableLightweightModel - Whether to use lightweight model (gpt-4o-mini, claude-3-5-haiku-latest)
     * @returns true if summarization was performed, false if skipped
     */
    summarize(
        characterName: string,
        llmService: LLMService,
        apiKey: string,
        modelName: string,
        enableLightweightModel: boolean
    ): Promise<boolean>;
}
