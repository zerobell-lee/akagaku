import { IChatHistorySummarizer } from "main/application/ports/IChatHistorySummarizer";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { formatDatetime } from "../utils/DatetimeStringUtils";
import { configRepository } from "../config/ConfigRepository";
import { LLMService } from "@shared/types";
import { SQLiteDatabase } from "../database/SQLiteDatabase";

interface MessageRow {
  id: number;
  character: string;
  type: string;
  content: string;
  emoticon: string | null;
  created_at: string;
  created_timestamp: number;
}

interface SummaryRow {
  id: number;
  character: string;
  content: string;
  created_at: string;
  created_timestamp: number;
  message_count: number | null;
}

/**
 * Chat History Summarizer Implementation (SQLite-based)
 *
 * Summarizes conversation history using LLM to reduce token usage.
 * Works directly with SQLite database instead of in-memory objects.
 */
export class ChatHistorySummarizer implements IChatHistorySummarizer {
    /**
     * Summarize chat history for a character
     *
     * @param characterName - Character identifier
     * @param llmService - LLM service to use
     * @param apiKey - API key for LLM service
     * @param modelName - Model name to use
     * @param enableLightweightModel - Whether to use lightweight model
     * @returns true if summarization was performed, false if skipped
     */
    async summarize(
        characterName: string,
        llmService: LLMService,
        apiKey: string,
        modelName: string,
        enableLightweightModel: boolean
    ): Promise<boolean> {
        const db = SQLiteDatabase.getInstance();
        const summarizationThreshold = configRepository.getConfig('summarizationThreshold') as number || 40;
        const keepRecentMessages = configRepository.getConfig('keepRecentMessages') as number || 20;
        const MIN_SUMMARIZE = 10; // Minimum messages to make summarization worthwhile

        // 1. Get last summary timestamp
        const lastSummary = db.prepare(`
            SELECT * FROM summaries
            WHERE character = ?
            ORDER BY created_timestamp DESC
            LIMIT 1
        `).get(characterName) as SummaryRow | undefined;

        const lastSummaryTimestamp = lastSummary?.created_timestamp || 0;

        // 2. Get all unsummarized messages (excluding system messages for counting)
        const unsummarizedRows = db.prepare(`
            SELECT * FROM messages
            WHERE character = ? AND created_timestamp > ?
            ORDER BY created_timestamp ASC
        `).all(characterName, lastSummaryTimestamp) as MessageRow[];

        const unsummarizedCount = unsummarizedRows.filter(row => row.type !== 'system').length;

        // 3. Validation checks
        if (unsummarizedCount <= summarizationThreshold) {
            console.log(`[ChatHistorySummarizer] Skipped: ${unsummarizedCount} unsummarized messages (threshold: ${summarizationThreshold})`);
            return false;
        }

        if (unsummarizedRows.length <= keepRecentMessages) {
            console.log(`[ChatHistorySummarizer] Skipped: only ${unsummarizedRows.length} messages (keeping ${keepRecentMessages} recent)`);
            return false;
        }

        // 4. Split messages: to summarize vs to keep
        const messagesToSummarize = unsummarizedRows.slice(0, unsummarizedRows.length - keepRecentMessages);
        const recentMessages = unsummarizedRows.slice(unsummarizedRows.length - keepRecentMessages);

        if (messagesToSummarize.length < MIN_SUMMARIZE) {
            console.log(`[ChatHistorySummarizer] Skipped: only ${messagesToSummarize.length} messages to summarize (min: ${MIN_SUMMARIZE})`);
            return false;
        }

        console.log(`[ChatHistorySummarizer] Summarizing: ${messagesToSummarize.length} messages, keeping ${recentMessages.length} recent`);

        // 5. Build conversation text for LLM
        const conversationText = messagesToSummarize
            .filter(row => row.type !== 'system')
            .map(row => {
                const datetime = formatDatetime(new Date(row.created_at));
                const role = row.type === 'user' ? 'User' : characterName;
                return `${datetime} | ${role}: ${row.content}`;
            })
            .join('\n');

        const summaryPrompt = `Summarize the following conversation in 3-5 direct factual sentences.

RULES:
- Use direct statements of what happened (e.g., "Character ate food and user agreed")
- DO NOT use meta-phrases like "This conversation is about", "The discussion covered", "They talked about"
- Focus on actions, events, and facts that occurred
- Include emotional context when relevant
- Write as if documenting events, not describing a conversation

Conversation between user and ${characterName || 'character'}:
${conversationText}

Summary:`;

        try {
            // 6. Generate summary with LLM
            let model;
            if (llmService === 'openai') {
                model = new ChatOpenAI({
                    modelName: enableLightweightModel ? 'gpt-4o-mini' : modelName,
                    temperature: 0,
                    openAIApiKey: apiKey
                });
            } else if (llmService === 'anthropic') {
                model = new ChatAnthropic({
                    modelName: enableLightweightModel ? 'claude-3-5-haiku-latest' : modelName,
                    temperature: 0,
                    apiKey: apiKey
                });
            } else {
                console.log('[ChatHistorySummarizer] Skipped: unsupported LLM provider');
                return false;
            }

            const result = await model.invoke(summaryPrompt);
            const summaryContent = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

            // 7. Get timestamp of LAST summarized message (critical for query correctness)
            const lastSummarizedMessage = messagesToSummarize[messagesToSummarize.length - 1];
            const summaryTimestamp = lastSummarizedMessage.created_timestamp;
            const summaryCreatedAt = new Date(lastSummarizedMessage.created_at).toISOString();

            // 8. Insert summary into database
            db.prepare(`
                INSERT INTO summaries (character, content, created_at, created_timestamp, message_count)
                VALUES (?, ?, ?, ?, ?)
            `).run(
                characterName,
                `[Conversation Summary]\n${summaryContent}`,
                summaryCreatedAt,
                summaryTimestamp,
                messagesToSummarize.length
            );

            console.log(`[ChatHistorySummarizer] Complete: Summarized ${messagesToSummarize.length} messages, kept ${recentMessages.length} recent, summary timestamp: ${summaryCreatedAt}`);

            return true;
        } catch (e) {
            console.error('[ChatHistorySummarizer] Failed:', e);
            return false;
        }
    }
}

// Export singleton instance
export const chatHistorySummarizer = new ChatHistorySummarizer();
