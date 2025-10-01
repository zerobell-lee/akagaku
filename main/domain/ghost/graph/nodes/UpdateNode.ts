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

    const currentUserSettingStr = JSON.stringify(state.user_setting, null, 2);

    const systemPrompt = `You're a helpful assistant that updates user's setting.

**CURRENT USER SETTING:**
${currentUserSettingStr}

**IMPORTANT RULES:**
1. ONLY update if NEW information is found in recent conversations
2. USE EXISTING KEYS whenever possible (check current setting above)
3. Call update_user_setting ONCE with ALL updates in keyValues array
4. DO NOT create duplicate keys (e.g., if 'name' exists, don't create 'user_name')
5. Preserve existing key names and structure

**Recommended to update:**
- name, age, location (only when user explicitly asked to remember), occupation, hobby

**NOT recommended to update:**
- affection_score, attitude, current_time, last_action, feelings, locale

**Examples of CORRECT usage:**
- If setting has 'name': Update with {key: 'name', value: 'John'}
- Multiple updates: [{key: 'name', value: 'John'}, {key: 'age', value: '25'}]

**Examples of WRONG usage:**
- Creating 'user_name' when 'name' exists
- Multiple tool calls for multiple updates
- Updating with same value as current setting

If nothing to update, just say "No update needed".
    `;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["placeholder", "{user_setting}"],
        ["placeholder", "{chat_history}"],
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
            user_setting: `user_setting = ${JSON.stringify(state.user_setting)}`,
            chat_history: `chat_history = ${JSON.stringify(state.update_payload?.history.getMessages().map(message => message.toChatLog()).map(chatLog => `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`).join('\n'))}`
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
