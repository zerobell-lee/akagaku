import { IChatHistorySummarizer } from "main/application/ports/IChatHistorySummarizer";
import { AkagakuChatHistory } from "./ChatHistoryRepository";
import { AkagakuSystemMessage } from "main/domain/message/AkagakuMessage";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { formatDatetime } from "../utils/DatetimeStringUtils";
import { configRepository } from "../config/ConfigRepository";
import { LLMService } from "@shared/types";

/**
 * Chat History Summarizer Implementation
 *
 * Summarizes conversation history using LLM to reduce token usage.
 * Keeps recent messages intact and summarizes older ones.
 */
export class ChatHistorySummarizer implements IChatHistorySummarizer {
    async summarize(
        chatHistory: AkagakuChatHistory,
        characterName: string,
        llmService: LLMService,
        apiKey: string,
        modelName: string,
        enableLightweightModel: boolean
    ): Promise<AkagakuChatHistory | null> {
        const summarizationThreshold = configRepository.getConfig('summarizationThreshold') as number || 20;
        const allMessages = chatHistory.getAllMessagesInternal();

        // Find last summary index
        let lastSummaryIndex = -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
            if (allMessages[i].isSummary === true) {
                lastSummaryIndex = i;
                break;
            }
        }

        const unsummarizedMessages = lastSummaryIndex >= 0
            ? allMessages.slice(lastSummaryIndex + 1)
            : allMessages;

        const unsummarizedCount = unsummarizedMessages.filter(msg => msg.type !== 'system').length;

        // Skip if below threshold
        if (unsummarizedCount <= summarizationThreshold) {
            console.log(`[ChatHistorySummarizer] Skipped: ${unsummarizedCount} unsummarized messages (threshold: ${summarizationThreshold})`);
            return null;
        }

        const keepRecentCount = 10;
        const totalUnsummarizedLength = unsummarizedMessages.length;

        // Only summarize if we have more than keepRecentCount messages
        if (totalUnsummarizedLength <= keepRecentCount) {
            console.log(`[ChatHistorySummarizer] Skipped: only ${totalUnsummarizedLength} messages (keeping ${keepRecentCount} recent)`);
            return null;
        }

        const messagesToSummarize = unsummarizedMessages.slice(0, totalUnsummarizedLength - keepRecentCount);
        const recentMessages = unsummarizedMessages.slice(totalUnsummarizedLength - keepRecentCount);

        console.log(`[ChatHistorySummarizer] Summarizing: ${messagesToSummarize.length} messages, keeping ${recentMessages.length} recent`);

        const conversationText = messagesToSummarize
            .filter(msg => msg.type !== 'system')
            .map(msg => {
                const chatLog = msg.toChatLog();
                return `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`;
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
                return null;
            }

            const result = await model.invoke(summaryPrompt);
            const summaryContent = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

            const summaryMessage = new AkagakuSystemMessage({
                content: `[Conversation Summary]\n${summaryContent}`,
                createdAt: new Date(),
                isSummary: true
            });

            const summaryInsertIndex = lastSummaryIndex >= 0
                ? lastSummaryIndex + 1 + messagesToSummarize.length
                : messagesToSummarize.length;

            const newMessages = [
                ...allMessages.slice(0, summaryInsertIndex),
                summaryMessage,
                ...allMessages.slice(summaryInsertIndex)
            ];

            const newChatHistory = new AkagakuChatHistory(
                newMessages,
                newMessages.length
            );

            console.log(`[ChatHistorySummarizer] Complete: Inserted summary at index ${summaryInsertIndex}, total ${newMessages.length} messages`);

            return newChatHistory;
        } catch (e) {
            console.error('[ChatHistorySummarizer] Failed:', e);
            return null;
        }
    }
}

// Export singleton instance
export const chatHistorySummarizer = new ChatHistorySummarizer();
