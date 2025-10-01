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
import { ToolRegistry } from "main/domain/services/ToolRegistry";

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

export const createAgentForTool = async (llmProperties: llmProperties, toolPrompt: string, toolRegistry: ToolRegistry | null = null): Promise<Runnable> => {
    let newLlmProperties = llmProperties;
    if (llmProperties.llmService === 'anthropic') {
        newLlmProperties = {
            ...llmProperties,
            modelName: 'claude-3-5-haiku-latest',
            temperature: 0,
        }
    }

    if (llmProperties.llmService === 'openai') {
        newLlmProperties = {
            ...llmProperties,
            modelName: 'gpt-4o-mini',
            temperature: 0,
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

    // Use ToolRegistry if available, otherwise fallback to core_tools
    const tools = toolRegistry ? toolRegistry.getActiveLangChainTools() : core_tools;

    const agent = createToolCallingAgent({ llm: model, tools: tools, prompt: prompt });
    const executor = new AgentExecutor({
        agent: agent,
        tools: tools,
        returnIntermediateSteps: true,
    }).withConfig({
        runName: "ghost-tool"
    });

    return executor;
}

export const createAgentForConversation = async (llmProperties: llmProperties, systemPrompt: string): Promise<Runnable> => {
    const model = await getLlmModel(llmProperties);
    const prompt =
        ChatPromptTemplate.fromMessages([
            ["system", `${systemPrompt}

{character_setting}

{user_setting}

{relationship}

{available_emoticon}

{current_appearance}

{tool_call_result}`],
            ["placeholder", "{chat_history}"],
        ]);

    return prompt.pipe(model).withConfig({ runName: "ghost" });
}
