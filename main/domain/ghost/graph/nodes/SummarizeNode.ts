import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { AkagakuSystemMessage } from "main/domain/message/AkagakuMessage";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { configRepository } from "main/infrastructure/config/ConfigRepository";

/**
 * Summarization Node
 * Automatically summarizes conversation when message count exceeds threshold
 * Reduces token usage by compressing old messages into summary
 */

const KEEP_RECENT_MESSAGES = 20; // Keep last 20 messages after summarization

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
        const messageCount = chat_history.getMessages(999).length;

        // Skip if below threshold
        if (messageCount <= summarizationThreshold) {
            return {};
        }

        // Check if lightweight model is enabled
        const enableLightweightModel = configRepository.getConfig('enableLightweightModel') !== false;

        console.log(`[Performance] Summarizing conversation: ${messageCount} messages -> ${KEEP_RECENT_MESSAGES} + summary`);

        const allMessages = chat_history.getMessages(999);
        const messagesToSummarize = allMessages.slice(0, messageCount - KEEP_RECENT_MESSAGES);
        const recentMessages = allMessages.slice(messageCount - KEEP_RECENT_MESSAGES);

        // Create summarization prompt
        const conversationText = messagesToSummarize
            .filter(msg => msg.type !== 'system')
            .map(msg => {
                const chatLog = msg.toChatLog();
                return `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`;
            })
            .join('\n');

        const summaryPrompt = `Summarize the following conversation between user and ${character_setting.name || 'character'}.
Focus on key topics discussed, important facts mentioned, and emotional progression.
Keep it concise (3-5 sentences).

Conversation:
${conversationText}

Summary:`;

        try {
            // Use lightweight model for summarization if enabled
            let model;
            if (llmProperties.llmService === 'openai') {
                model = new ChatOpenAI({
                    modelName: enableLightweightModel ? 'gpt-4o-mini' : llmProperties.modelName,
                    temperature: 0.3,
                    openAIApiKey: llmProperties.apiKey
                });
            } else if (llmProperties.llmService === 'anthropic') {
                model = new ChatAnthropic({
                    modelName: enableLightweightModel ? 'claude-3-5-haiku-latest' : llmProperties.modelName,
                    temperature: 0.3,
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

            // Add summary to existing messages (don't delete old messages)
            const newChatHistory = new AkagakuChatHistory(
                [...allMessages, summaryMessage],
                chat_history.getMessages().length
            );

            console.log(`[Performance] Summarization complete: ${messageCount} -> ${newChatHistory.getMessages(999).length} messages`);

            return {
                chat_history: newChatHistory
            };

        } catch (e) {
            console.error('[Performance] Summarization failed:', e);
            return {};
        }
    }
});