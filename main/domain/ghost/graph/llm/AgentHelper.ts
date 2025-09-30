import { llmProperties } from "../states";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { initChatModel } from 'langchain/chat_models/universal'
import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { createToolCallingAgent } from "langchain/agents";
import { core_tools } from "main/domain/tools/core";
import { AgentExecutor } from "langchain/agents";
import { Runnable } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

const getLlmModel = async (llmProperties: llmProperties): Promise<BaseChatModel> => {
    const { llmService, modelName, apiKey, temperature, baseURL } = llmProperties;

    // Handle custom base URL or special providers
    if (baseURL || llmService === 'openrouter' || llmService === 'custom') {
        // Use ChatOpenAI with custom configuration for OpenAI-compatible APIs
        const effectiveBaseURL = baseURL ||
            (llmService === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined);

        return new ChatOpenAI({
            modelName: modelName,
            temperature: temperature,
            openAIApiKey: apiKey,
            configuration: {
                baseURL: effectiveBaseURL
            }
        });
    }

    // Use universal loader for standard providers
    let model = null;
    model = await initChatModel(modelName, {
        modelProvider: llmService as any,
        temperature: temperature,
        apiKey: apiKey
    });
    return model;
}

export const createAgentForTool = async (llmProperties: llmProperties, toolPrompt: string): Promise<Runnable> => {
    let newLlmProperties = llmProperties;
    if (llmProperties.llmService === 'anthropic') {
        newLlmProperties = {
            ...llmProperties,
            modelName: 'claude-3-5-haiku-latest',
        }
    }

    if (llmProperties.llmService === 'openai') {
        newLlmProperties = {
            ...llmProperties,
            modelName: 'gpt-4o-mini',
        }
    }

    const prompt =
        ChatPromptTemplate.fromMessages([
            ["system", toolPrompt],
            ["placeholder", "{conversation_context}"],
            ["human", "{input}"],
            ["placeholder", "{tool_history}"],
            ["placeholder", "{agent_scratchpad}"],
        ]);
    let model = await getLlmModel(newLlmProperties);

    if (!model) {
        return null
    }

    return prompt.pipe(model.bindTools(core_tools).withConfig({ runName: "ghost-tool" }))

    const agent = createToolCallingAgent({ llm: model, tools: core_tools, prompt: prompt });
    const executor = new AgentExecutor({
        agent: agent,
        tools: core_tools,
    }).withConfig({
        runName: "ghost-tool"
    });

    return executor;
}

export const createAgentForConversation = async (llmProperties: llmProperties, systemPrompt: string): Promise<Runnable> => {
    const model = await getLlmModel(llmProperties);
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

    return prompt.pipe(model).withConfig({ runName: "ghost" });
}
