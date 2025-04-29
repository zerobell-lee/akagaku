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

export const UpdateChatHistoryNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { update_payload, character_setting } = state;
        if (!update_payload) {
            return {};
        }
        const { relationship, history } = update_payload;
        await updateCharacterRelationships(relationship.character, relationship.affection_to_user, relationship.attitude_to_user);
        await updateChatHistory(character_setting.character_id, history);
        return {}
    }
})

export const UpdateUserSettingNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { llmProperties } = state;
        const { llmService, modelName, apiKey, temperature } = llmProperties;

        let model = null;
        try {
            if (llmService === 'openai' && apiKey !== "" && apiKey !== null) {
                model = new ChatOpenAI({ modelName: modelName, apiKey: apiKey, temperature: temperature }).bindTools([update_user_info]);
            } else if (llmService === 'anthropic' && apiKey !== "" && apiKey !== null) {
                model = new ChatAnthropic({ modelName: modelName, apiKey: apiKey, temperature: temperature }).bindTools([update_user_info]);
            }
        } catch (error) {
            console.error(error);
        }
        
        if (!model) {
            return {}
        }

        const systemPrompt = `You're a helpful assistant that updates user's setting.
        Summarize conversations and compare with user's setting.
        Then, decide what information to update.
        These kinds of information are recommended to be updated:
        - user_name
        - user_age
        - user_location (only when user asked character to remember his location)
        - user_occupation
        - user_hobby

        These kinds of information are NOT recommended to be updated:
        - user's affection score
        - user's attitude
        - user's current time
        - user's last action
        - user's feelings

        If you don't need to update anything, just say "No update needed".
        `;

        const prompt =
            ChatPromptTemplate.fromMessages([
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
            runName: "ghost"
        });
        const result = await executor.invoke({
            user_setting: `user_setting = ${JSON.stringify(state.user_setting)}`,
            chat_history: `chat_history = ${JSON.stringify(state.update_payload?.history.getMessages().map(message => message.message))}`
        });
        return {}
    }
})
