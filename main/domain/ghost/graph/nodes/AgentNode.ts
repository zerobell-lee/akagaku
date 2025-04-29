import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent } from "langchain/agents";

import { AgentExecutor } from "langchain/agents";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";

export const AgentNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { llmService, modelName, apiKey, temperature } = state.llmProperties;

        console.log('llmProperties', state.llmProperties)

    const systemPrompt = state.promptForCharacter;

    const prompt =
            ChatPromptTemplate.fromMessages([
                ["system", systemPrompt],
                ["placeholder", "{character_setting}"],
                ["placeholder", "{available_emoticon}"],
                ["placeholder", "{user_setting}"],
                ["placeholder", "{chat_history}"],
                ["placeholder", "{relationship}"],
                ["placeholder", "{conversation_context}"],
                ["placeholder", "{tool_call_result}"],
                ["human", "{input}"],
                ["placeholder", "{agent_scratchpad}"],
            ]);
        let model = null;
        try {
            if (llmService === 'openai' && apiKey !== "" && apiKey !== null) {
                model = new ChatOpenAI({ modelName: modelName, apiKey: apiKey, temperature: temperature }).bindTools([]);
            } else if (llmService === 'anthropic' && apiKey !== "" && apiKey !== null) {
                model = new ChatAnthropic({ modelName: modelName, apiKey: apiKey, temperature: temperature }).bindTools([]);
            }
        } catch (error) {
            console.error(error);
        }
        
        if (!model) {
            return {}
        }

        const agent = createToolCallingAgent({ llm: model, tools: [], prompt: prompt });
        const executor = new AgentExecutor({
            agent: agent,
            tools: []
        }).withConfig({
            runName: "ghost"
        });

    return { executor: executor, aiResponseParser: new AIResponseParser(llmService) };
}
}); 