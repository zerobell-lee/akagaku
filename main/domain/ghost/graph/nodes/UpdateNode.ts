import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { updateCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { updateChatHistory, chatHistoryRepository } from "main/infrastructure/chat/ChatHistoryRepository";
import { AgentExecutor } from "langchain/agents";
import { createToolCallingAgent } from "langchain/agents";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { core_tools, update_user_info } from "main/domain/tools/core";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { configRepository } from "main/infrastructure/config/ConfigRepository";

// Global callback for broadcasting relationship updates
let relationshipUpdateCallback: ((affection: number, attitude: string) => void) | null = null;

export function setRelationshipUpdateCallback(callback: (affection: number, attitude: string) => void): void {
    relationshipUpdateCallback = callback;
}

function broadcastRelationshipUpdate(affection: number, attitude: string): void {
    if (relationshipUpdateCallback) {
        relationshipUpdateCallback(affection, attitude);
    }
}

export const UpdateChatHistoryNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { update_payload, character_setting, is_user_update_needed } = state;
        if (!update_payload) {
            return {};
        }
        const { relationship, history } = update_payload;
        await updateCharacterRelationships(relationship.character, relationship.affection_to_user, relationship.attitude_to_user);
        await updateChatHistory(character_setting.character_id, history);

        // Broadcast relationship update to character info window
        broadcastRelationshipUpdate(relationship.affection_to_user, relationship.attitude_to_user);

        // Trigger background user setting update if needed
        if (is_user_update_needed) {
            console.log('[Performance] Triggering background user setting update');
            // Execute in background without blocking
            executeUpdateUserSettingInBackground(state).catch(error => {
                console.error('[Performance] Background user setting update failed:', error);
            });
        }

        return {}
    }
})

// Background execution function for UpdateUserSetting
async function executeUpdateUserSettingInBackground(state: GhostState): Promise<void> {
    const { llmProperties } = state;
    const { llmService, modelName, apiKey } = llmProperties;

    // Check if lightweight model is enabled for user updates
    const enableLightweightModel = configRepository.getConfig('enableLightweightModel') !== false;

    let model = null;
    try {
        if (llmService === 'openai' && apiKey !== "" && apiKey !== null) {
            const updateModelName = enableLightweightModel ? 'gpt-4o-mini' : modelName;
            model = new ChatOpenAI({
                modelName: updateModelName,
                apiKey: apiKey,
                temperature: 0
            }).bindTools([update_user_info]);
            console.log(`[UpdateUserSetting] Background execution with model: ${updateModelName}`);
        } else if (llmService === 'anthropic' && apiKey !== "" && apiKey !== null) {
            const updateModelName = enableLightweightModel ? 'claude-3-5-haiku-latest' : modelName;
            model = new ChatAnthropic({
                modelName: updateModelName,
                apiKey: apiKey,
                temperature: 0
            }).bindTools([update_user_info]);
            console.log(`[UpdateUserSetting] Background execution with model: ${updateModelName}`);
        }
    } catch (error) {
        console.error('[UpdateUserSetting] Model initialization failed:', error);
        return;
    }

    if (!model) {
        console.log('[UpdateUserSetting] No model available, skipping update');
        return;
    }

    const currentUserProfile = typeof state.user_setting === 'string'
        ? state.user_setting
        : JSON.stringify(state.user_setting, null, 2);

    // Get recent raw messages directly from DB (excludes system messages, regardless of summary state)
    // Update runs every 10 conversations, each conversation = 2 messages (user + character)
    // So we need 20 messages to cover all 10 conversations since last update
    const recentMessages = chatHistoryRepository.getRecentRawMessages(
        state.character_setting.character_id,
        20  // 10 conversations × 2 messages per conversation
    );
    const chatHistoryStr = recentMessages
        .map(message => message.toChatLog())
        .map(chatLog => `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`)
        .join('\n') || '';

    const systemPrompt = `Update user profile ONLY if new info found. Max 300 chars/15 lines.

CURRENT PROFILE:
${currentUserProfile}

RECENT CHAT:
${chatHistoryStr}

INSTRUCTIONS:
- NEW info → call update_user_setting tool
- NO new info → respond "No update needed" (nothing else)
- DO NOT explain, apologize, or add commentary
- Profile must include: name, birth date, occupation, location, languages, hobbies

Example:
# User Profile
**Name:** 이영종
**Birth Date:** 1994-03-10
**Occupation:** 백엔드 개발자
**Location:** Seoul
**Languages:** 한국어, 일본어, 영어
**Hobbies:** 고양이 키우기

## Notes
Minimal communication.`;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "Check for new info. Call tool or say 'No update needed'."],
        ["placeholder", "{agent_scratchpad}"],
    ]);

    const agent = createToolCallingAgent({ llm: model, tools: [update_user_info], prompt: prompt });
    const executor = new AgentExecutor({
        agent: agent,
        tools: [update_user_info],
    }).withConfig({
        runName: "ghost_background_update"
    });

    try {
        const result = await executor.invoke({
            agent_scratchpad: []
        });
        console.log('[UpdateUserSetting] Background update completed:', result.output || 'success');
    } catch (error) {
        console.error('[UpdateUserSetting] Background execution error:', error);
    }
}

// Deprecated: UpdateUserSettingNode is now executed in background
// See executeUpdateUserSettingInBackground() function above
export const UpdateUserSettingNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        // This node is no longer used in the graph
        // User setting updates are now executed in background after UpdateChatHistoryNode
        console.warn('[UpdateUserSettingNode] This node should not be called - updates are now background');
        return {}
    }
})
