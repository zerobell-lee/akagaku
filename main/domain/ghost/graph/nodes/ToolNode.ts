import { ChatAnthropic } from "@langchain/anthropic";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent } from "langchain/agents";

import { AgentExecutor } from "langchain/agents";
import { core_tools } from "main/domain/tools/core";
import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GhostResponse } from "@shared/types";

export const ToolNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { llmService, modelName, apiKey, temperature } = state.llmProperties;
        const aiMessageParser = state.aiResponseParser;

        console.log('llmProperties', state.llmProperties)

    const systemPrompt = state.promptForTool;

    const prompt =
            ChatPromptTemplate.fromMessages([
                ["system", systemPrompt],
                ["placeholder", "{conversation_context}"],
                ["human", "{input}"],
                ["placeholder", "{agent_scratchpad}"],
            ]);
        let model = null;
        try {
            if (llmService === 'openai' && apiKey !== "" && apiKey !== null) {
                model = new ChatOpenAI({ modelName: modelName, apiKey: apiKey, temperature: temperature }).bindTools(core_tools);
            } else if (llmService === 'anthropic' && apiKey !== "" && apiKey !== null) {
                model = new ChatAnthropic({ modelName: modelName, apiKey: apiKey, temperature: temperature }).bindTools(core_tools);
            }
        } catch (error) {
            console.error(error);
        }
        
        if (!model) {
            return {}
        }

        const agent = createToolCallingAgent({ llm: model, tools: state.tools, prompt: prompt });
        const executor = new AgentExecutor({
            agent: agent,
            tools: state.tools,
        }).withConfig({
            runName: "ghost"
        });

        const conversations = []

        for (const message of state.chat_history.getMessages()) {
            let tmpMessageContent = message.message.content as string
            let role = 'User'
            if (message.message instanceof AIMessage) {
                const parsed = JSON.parse(tmpMessageContent) as GhostResponse
                tmpMessageContent = parsed.message
                role = 'Character'
            }
            if (message.message instanceof HumanMessage) {
                tmpMessageContent = tmpMessageContent.replace(/^\d+\|/, '')
            }
            if (message.message instanceof SystemMessage) {
                role = 'System'
            }

            const messageContent = `[${message.timestamp}] ${role}: ${tmpMessageContent}`
            conversations.push(messageContent)
        }

        // Start of Selection
        const conversationContext = state.chat_history.getMessages().slice(-6).map(({message}) => `${message instanceof HumanMessage ? 'User' : 'Character'}: ${message.content}`).join("\n");

        try {
            const result = await executor.invoke({
                conversation_context: `conversation_context = ${JSON.stringify(conversationContext)}`,
                input: state.input.input
            });
    
            const toolCallResult = aiMessageParser.parseToolResponse(result);        
    
            return { tool_call_result: toolCallResult };
        } catch (e) {
            console.log('tool node error', e)
            return { tool_call_result: { tool_call_chain: [], final_answer: '' } };
        }
        
}
}); 