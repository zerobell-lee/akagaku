import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AkagakuChatHistory, chatHistoryRepository } from "main/infrastructure/chat/ChatHistoryRepository";
import { AkagakuSystemMessage } from "main/domain/message/AkagakuMessage";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { configRepository } from "main/infrastructure/config/ConfigRepository";

/**
 * Summarization Node
 * Automatically summarizes conversation when message count exceeds threshold
 * Reduces token usage by compressing old messages into summary
 */

export const SummarizeNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { chat_history, llmProperties, character_setting } = state;

        // Check if auto-summarization is enabled
        const enableAutoSummarization = configRepository.getConfig('enableAutoSummarization') !== false;
        if (!enableAutoSummarization) {
            return {};
        }

        // Get threshold from config (default 40)
        const summarizationThreshold = configRepository.getConfig('summarizationThreshold') as number || 40;
        const allMessages = chat_history.getAllMessagesInternal();

        // Find last summary index
        let lastSummaryIndex = -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
            if (allMessages[i].isSummary === true) {
                lastSummaryIndex = i;
                break;
            }
        }

        // Get messages after last summary (unsummarized messages)
        const unsummarizedMessages = lastSummaryIndex >= 0
            ? allMessages.slice(lastSummaryIndex + 1)  // Skip the summary itself
            : allMessages;

        // Count all unsummarized messages (exclude only summaries and system messages)
        const unsummarizedCount = unsummarizedMessages.filter(msg => msg.type !== 'system').length;

        // Skip if below threshold
        if (unsummarizedCount <= summarizationThreshold) {
            console.log(`[Performance] Summarization skipped: ${unsummarizedCount} unsummarized messages (threshold: ${summarizationThreshold})`);
            return {};
        }

        // Check if lightweight model is enabled
        const enableLightweightModel = configRepository.getConfig('enableLightweightModel') !== false;

        // Keep only a few recent messages (2-3), summarize the rest
        const keepRecentCount = 2;
        const totalUnsummarizedLength = unsummarizedMessages.length;
        const messagesToSummarize = unsummarizedMessages.slice(0, totalUnsummarizedLength - keepRecentCount);
        const recentMessages = unsummarizedMessages.slice(totalUnsummarizedLength - keepRecentCount);

        console.log(`[Performance] Summarizing: ${messagesToSummarize.length} messages, keeping ${recentMessages.length} recent`);

        // Create summarization prompt
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

Conversation between user and ${character_setting.name || 'character'}:
${conversationText}

Summary:`;

        try {
            // Use lightweight model for summarization if enabled
            let model;
            if (llmProperties.llmService === 'openai') {
                model = new ChatOpenAI({
                    modelName: enableLightweightModel ? 'gpt-4o-mini' : llmProperties.modelName,
                    temperature: 0,
                    openAIApiKey: llmProperties.apiKey
                });
            } else if (llmProperties.llmService === 'anthropic') {
                model = new ChatAnthropic({
                    modelName: enableLightweightModel ? 'claude-3-5-haiku-latest' : llmProperties.modelName,
                    temperature: 0,
                    apiKey: llmProperties.apiKey
                });
            } else {
                // Skip summarization for unsupported providers
                console.log('[Performance] Summarization skipped: unsupported LLM provider');
                return {};
            }

            const result = await model.invoke(summaryPrompt);
            const summaryContent = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

            // Create summary message with isSummary flag
            const summaryMessage = new AkagakuSystemMessage({
                content: `[Conversation Summary]\n${summaryContent}`,
                createdAt: new Date(),
                isSummary: true
            });

            // Insert summary after summarized messages, before recent messages
            // Structure: [msg1..msg10] + [SUMMARY] + [msg11, msg12] + future messages
            const summaryInsertIndex = lastSummaryIndex >= 0
                ? lastSummaryIndex + 1 + messagesToSummarize.length  // After old summary + summarized messages
                : messagesToSummarize.length;  // After summarized messages

            const newMessages = [
                ...allMessages.slice(0, summaryInsertIndex),
                summaryMessage,
                ...allMessages.slice(summaryInsertIndex)
            ];

            const newChatHistory = new AkagakuChatHistory(
                newMessages,
                newMessages.length
            );

            console.log(`[Performance] Summarization complete: Inserted summary at index ${summaryInsertIndex}, total ${newMessages.length} messages`);

            return {
                chat_history: newChatHistory
            };

        } catch (e) {
            console.error('[Performance] Summarization failed:', e);
            return {};
        }
    }
});