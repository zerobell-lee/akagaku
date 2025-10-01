import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { updateCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { updateChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { AgentExecutor } from "langchain/agents";
import { createToolCallingAgent } from "langchain/agents";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { core_tools, update_user_info } from "main/domain/tools/core";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { configRepository } from "main/infrastructure/config/ConfigRepository";

export const UpdateChatHistoryNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { update_payload, character_setting, is_user_update_needed } = state;
        if (!update_payload) {
            return {};
        }
        const { relationship, history } = update_payload;
        await updateCharacterRelationships(relationship.character, relationship.affection_to_user, relationship.attitude_to_user);
        await updateChatHistory(character_setting.character_id, history);

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

    const chatHistoryStr = state.update_payload?.history.getMessages()
        .map(message => message.toChatLog())
        .map(chatLog => `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`)
        .join('\n') || '';

    const systemPrompt = `You're a helpful assistant that updates user's profile.

**CURRENT USER PROFILE:**
${currentUserProfile}

**RECENT CHAT HISTORY:**
${chatHistoryStr}

**TASK:**
If you found NEW important information about the user in recent conversations,
create an UPDATED complete user profile in markdown format.

**STRICT CONSTRAINTS:**
- Maximum 300 characters OR 15 lines (whichever is shorter)
- Be CONCISE - only essential information
- Replace the ENTIRE profile (not partial update)
- Use markdown format with clear structure

**Profile Structure:**
# User Profile

**Name:** [name]
**Birth Date:** [date]
**Occupation:** [job]
**Location:** [city/country]
**Languages:** [languages]
**Hobbies:** [hobbies]

## Notes
[Brief important notes only]

**What to INCLUDE:**
- Name, birth date, occupation, location
- Languages, hobbies
- Key facts user explicitly mentioned

**What to EXCLUDE:**
- Feelings, attitudes, affection scores
- Temporary states, current actions
- Conversation topics (unless user asked to remember)
- Verbose descriptions

**Decision:**
- If NO new information: Say "No update needed"
- If new information found: Call update_user_setting with complete updated profile

**Example GOOD profile:**
# User Profile

**Name:** 이영종
**Birth Date:** 1994-03-10
**Occupation:** 백엔드 개발자
**Location:** Seoul
**Languages:** 한국어, 일본어, 영어
**Hobbies:** 고양이 4마리 키우기

## Notes
Prefers minimal communication.
    `;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["human", "Review the current user profile and recent chat history. If you found new important information, update the profile. Otherwise, say 'No update needed'."],
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
