import { GhostResponse, LLMService, UserInput } from "@shared/types";
import { ResponseNode } from "./graph/nodes/ResponseNode";
import { UpdateChatHistoryNode, UpdateUserSettingNode } from "./graph/nodes/UpdateNode";
import { GhostState, llmProperties } from "./graph/states";
import { Annotation, CompiledStateGraph, END, START, StateDefinition, StateGraph } from "@langchain/langgraph";
import { getUserSetting } from "main/infrastructure/user/UserRepository";
import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { AkagakuChatHistory, getChatHistory, updateChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { core_tools } from "../tools/core";
import { configRepository } from "main/infrastructure/config/ConfigRepository";
import { ToolNode } from "./graph/nodes/ToolNode";
import { Runnable } from "@langchain/core/runnables";
import { createAgentForConversation, createAgentForTool } from "./graph/llm/AgentHelper";
import { loadToolPrompt, loadSystemPrompt } from "./graph/prompt/prompt";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { AkagakuMessageConverter } from "../message/AkagakuMessage";

export const createGhostGraph = () => {
    const StateAnnotation = Annotation.Root({
        userInput: Annotation<any>(),
        character_setting: Annotation<CharacterSetting>(),
        user_setting: Annotation<any>(),
        llmProperties: Annotation<{
            llmService: string,
            modelName: string,
            apiKey: string,
            temperature: number
        }>(),
        executor: Annotation<any>(),
        aiResponseParser: Annotation<any>(),
        invocation_result: Annotation<any>(),
        invocation_retry_policy: Annotation<{ maximum_trial: number }>(),
        llm_response: Annotation<any>(),
        chat_history: Annotation<AkagakuChatHistory>(),
        update_payload: Annotation<any>(),
        final_response: Annotation<any>(),
        tools: Annotation<any>(),
        promptForCharacter: Annotation<string>(),
        promptForTool: Annotation<string>(),
        tool_call_result: Annotation<any>(),
        is_user_update_needed: Annotation<boolean>(),
        toolAgent: Annotation<any>(),
        conversationAgent: Annotation<any>(),
        skipToolCall: Annotation<boolean>(),
        messageConverter: Annotation<any>()
    })

    const graph = new StateGraph(StateAnnotation)
        .addNode("tool", ToolNode)
        .addNode("updateChatHistory", UpdateChatHistoryNode)
        .addNode("updateUserSetting", UpdateUserSettingNode)
        .addNode("response", ResponseNode)
        .addConditionalEdges(START, (state) => {
            const { skipToolCall } = state;
            if (skipToolCall) {
                return 'response';
            } else {
                return 'tool';
            }
        },
            {
                tool: "tool",
                response: "response"
            }
        )
        .addEdge("tool", "response")
        .addConditionalEdges("response", (state) => {
            const { invocation_result, invocation_retry_policy } = state;
            console.log('invocation_result', invocation_result)
            if (invocation_result?.success === true) {
                return 'ok';
            } else {
                return 'end';
            }
        },
            {
                ok: "updateChatHistory",
                end: END
            }
        )
        .addConditionalEdges("updateChatHistory", (state) => {
            const { is_user_update_needed } = state;
            if (is_user_update_needed) {
                return 'updateUserSetting';
            } else {
                return 'end';
            }
        },
            {
                updateUserSetting: "updateUserSetting",
                end: END
            }
        )
        .addEdge("updateUserSetting", END)
        .compile();
    return graph;
}

export class Ghost {
    private graph: CompiledStateGraph<GhostState, Partial<GhostState>, "tool" | "update" | "response" | "retry", StateDefinition, StateDefinition, StateDefinition>;
    private llm_properties: llmProperties;
    private character_setting: CharacterSetting;
    private conversation_count: number;
    private toolAgent: Runnable | null;
    private conversationAgent: Runnable | null;
    private agentsInitialized: boolean = false;
    private messageConverter: AkagakuMessageConverter;

    constructor({ llm_properties, character_setting }: { llm_properties: llmProperties, character_setting: CharacterSetting }) {
        this.graph = createGhostGraph() as any;
        this.llm_properties = llm_properties;
        this.character_setting = character_setting;
        this.conversation_count = 0;
    }

    async invoke({ input, isSystemMessage }: { input: string, isSystemMessage: boolean }): Promise<GhostResponse> {
        if (!this.agentsInitialized) {
            await this.createAgents();
        }
        this.conversation_count++;
        const userSetting = getUserSetting();
        const chatHistory = getChatHistory(this.character_setting.character_id);
        const state: GhostState = {
            userInput: { payload: input, isSystemMessage },
            character_setting: this.character_setting,
            user_setting: userSetting,
            llmProperties: this.llm_properties,
            chat_history: chatHistory,
            invocation_retry_policy: { maximum_trial: 3 },
            aiResponseParser: new AIResponseParser(this.llm_properties.llmService),
            invocation_result: null,
            update_payload: null,
            final_response: null,
            tools: core_tools,
            promptForCharacter: '',
            promptForTool: '',
            skipToolCall: isSystemMessage,
            tool_call_result: null,
            is_user_update_needed: this.conversation_count % 5 === 0,
            toolAgent: this.toolAgent,
            conversationAgent: this.conversationAgent,
            messageConverter: this.messageConverter
        }
        const result = await this.graph.invoke(state);
        if (result.final_response) {
            return result.final_response;
        } else {
            throw new Error("Failed to generate response");
        }
    }

    isNewRendezvous() {
        const chatHistory = getChatHistory(this.character_setting.character_id);
        return chatHistory.getMessages().length === 0;
    }

    async resetChatHistory() {
        const history = new AkagakuChatHistory([], configRepository.getConfig('chatHistoryLimit') as number || 100);
        await updateChatHistory(this.character_setting.character_id, history);
    }

    private async createAgents() {
        const promptForTool = loadToolPrompt();
        const promptForCharacter = loadSystemPrompt(this.llm_properties.llmService);
        this.toolAgent = await createAgentForTool(this.llm_properties, promptForTool);
        this.conversationAgent = await createAgentForConversation(this.llm_properties, promptForCharacter);
        this.agentsInitialized = true;
        this.messageConverter = new AkagakuMessageConverter(this.llm_properties.llmService);
    }

    async updateExecuter({ openaiApiKey, anthropicApiKey, llmService, modelName, temperature }: { openaiApiKey: string | null, anthropicApiKey: string | null, llmService: string | null, modelName: string | null, temperature: number }) {
        this.llm_properties.apiKey = llmService === 'openai' ? openaiApiKey : anthropicApiKey;
        this.llm_properties.llmService = llmService as LLMService;
        this.llm_properties.modelName = modelName;
        this.llm_properties.temperature = temperature;
        await this.createAgents();
    }

    async sayHello() {
        if (this.isNewRendezvous()) {
            return await this.invoke({ input: "This is the first time you meet the user. Say hello to the user and ask about them, such as their name, birthdate, and occupation.", isSystemMessage: true });
        } else {
            return await this.invoke({ input: "User entered. Say hello to the user. you can consider how long it has passed since last conversation.", isSystemMessage: true });
        }
    }

    async sayGoodbye() {
        return await this.invoke({ input: "User is about to quit the application. Say goodbye to the user. Don't use any tools.", isSystemMessage: true });
    }

    async doChitChat() {
        return await this.invoke({ input: "Have a chit chat with the user. Don't use any tools.", isSystemMessage: true });
    }

    async sendRawMessage({ input, isSystemMessage }: { input: string, isSystemMessage: boolean }) {
        return await this.invoke({ input, isSystemMessage });
    }
}