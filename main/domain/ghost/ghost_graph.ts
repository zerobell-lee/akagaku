import { GhostResponse } from "@shared/types";
import { AgentNode } from "./graph/nodes/AgentNode";
import { InputNode } from "./graph/nodes/InputNode";
import { ResponseNode } from "./graph/nodes/ResponseNode";
import { RetryNode } from "./graph/nodes/RetryNode";
import { UpdateChatHistoryNode, UpdateUserSettingNode } from "./graph/nodes/UpdateNode";
import { GhostState, llmProperties } from "./graph/states";
import { Annotation, CompiledStateGraph, END, START, StateDefinition, StateGraph } from "@langchain/langgraph";
import { getUserSetting } from "main/infrastructure/user/UserRepository";
import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { AkagakuChatHistory, getChatHistory, updateChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { core_tools } from "../tools/core";
import { configRepository } from "main/infrastructure/config/ConfigRepository";
import { ToolNode } from "./graph/nodes/ToolNode";
import { BuildPromptNode } from "./graph/nodes/BuildPromptNode";
export const createGhostGraph = () => {
    const StateAnnotation = Annotation.Root({
        input: Annotation<{ input: string, isSystemMessage: boolean }>(),
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
        is_user_update_needed: Annotation<boolean>()
    })

    const graph = new StateGraph(StateAnnotation)
        .addNode("inputNode", InputNode)
        .addNode("buildPrompt", BuildPromptNode)
        .addNode("agent", AgentNode)
        .addNode("tool", ToolNode)
        .addNode("updateChatHistory", UpdateChatHistoryNode)
        .addNode("updateUserSetting", UpdateUserSettingNode)
        .addNode("response", ResponseNode)
        .addNode("retry", RetryNode)
        .addEdge(START, "inputNode")
        .addEdge("inputNode", "buildPrompt")
        .addEdge("buildPrompt", "agent")
        .addEdge("agent", "tool")
        .addEdge("tool", "response")
        .addConditionalEdges("response", (state) => {
            const { invocation_result, invocation_retry_policy } = state;
            console.log('invocation_result', invocation_result)
            if (invocation_result?.success === true) {
                return 'ok';
            } else if (invocation_result?.success === false && invocation_result.error_type === 'parseError' && invocation_result?.trial_count < invocation_retry_policy?.maximum_trial) {
                return 'retry';
            } else {
                return 'end';
            }
        },
            {
                ok: "updateChatHistory",
                retry: "retry",
                end: END
            }
        )
        .addConditionalEdges("retry", (state) => {
            const { invocation_result, invocation_retry_policy } = state;
            if (invocation_result?.success === true) {
                return 'ok';
            } else if (invocation_result?.success === false && invocation_result.error_type === 'parseError' && invocation_result?.trial_count < invocation_retry_policy?.maximum_trial) {
                return 'retry';
            } else {
                return 'end';
            }
        },
            {
                ok: "updateChatHistory",
                retry: "retry",
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
    private graph: CompiledStateGraph<GhostState, Partial<GhostState>, "inputNode" | "__start__" | "buildPrompt" | "agent" | "tool" | "update" | "response" | "retry", StateDefinition, StateDefinition, StateDefinition>;
    private llm_properties: llmProperties;
    private character_setting: CharacterSetting;
    private conversation_count: number;

    constructor({ llm_properties, character_setting }: { llm_properties: llmProperties, character_setting: CharacterSetting }) {
        this.graph = createGhostGraph() as any;
        this.llm_properties = llm_properties;
        this.character_setting = character_setting;
        this.conversation_count = 0;
    }

    async invoke({ input, isSystemMessage }: { input: string, isSystemMessage: boolean }): Promise<GhostResponse> {
        this.conversation_count++;
        const userSetting = getUserSetting();
        const chatHistory = getChatHistory(this.character_setting.character_id);
        const state: GhostState = {
            input: { input, isSystemMessage },
            character_setting: this.character_setting,
            user_setting: userSetting,
            llmProperties: this.llm_properties,
            chat_history: chatHistory,
            invocation_retry_policy: { maximum_trial: 3 },
            executor: null,
            aiResponseParser: null,
            invocation_result: null,
            update_payload: null,
            final_response: null,
            tools: core_tools,
            promptForCharacter: '',
            promptForTool: '',
            tool_call_result: null,
            is_user_update_needed: this.conversation_count % 5 === 0
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

    updateExecuter({ openaiApiKey, anthropicApiKey, llmService, modelName, temperature }: { openaiApiKey: string | null, anthropicApiKey: string | null, llmService: string | null, modelName: string | null, temperature: number }) {
        this.llm_properties.apiKey = llmService === 'openai' ? openaiApiKey : anthropicApiKey;
        this.llm_properties.llmService = llmService;
        this.llm_properties.modelName = modelName;
        this.llm_properties.temperature = temperature;
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