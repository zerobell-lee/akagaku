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
import { ToolCallDetector } from "./graph/utils/ToolCallDetector";
import { ToolRegistry } from "../services/ToolRegistry";
import { skinRepository } from "main/infrastructure/character/SkinRepository";
import { chatHistorySummarizer } from "main/infrastructure/chat/ChatHistorySummarizer";

export const createGhostGraph = () => {
    const StateAnnotation = Annotation.Root({
        userInput: Annotation<any>(),
        character_setting: Annotation<CharacterSetting>(),
        user_setting: Annotation<any>(),
        llmProperties: Annotation<{
            llmService: string,
            modelName: string,
            apiKey: string,
            temperature: number,
            baseURL?: string
        }>(),
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
        is_user_update_needed: Annotation<boolean>(),
        toolAgent: Annotation<any>(),
        conversationAgent: Annotation<any>(),
        skipToolCall: Annotation<boolean>(),
        messageConverter: Annotation<any>(),
        toolCallCompleted: Annotation<boolean>(),
        toolCallFinalAnswer: Annotation<string>(),
        toolCallHistory: Annotation<any>(),
        currentSkinDescription: Annotation<string>()
    })

    const graph = new StateGraph(StateAnnotation)
        .addNode("tool", ToolNode)
        .addNode("updateChatHistory", UpdateChatHistoryNode)
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
        .addConditionalEdges("tool", (state) => {
            const { toolCallCompleted } = state;
            if (toolCallCompleted) {
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
        .addEdge("updateChatHistory", END)  // User setting update now happens in background
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
    private summarizationLock: boolean = false;
    private pendingSummarization: Promise<void> | null = null;
    private toolRegistry: ToolRegistry | null = null;

    constructor({ llm_properties, character_setting, toolRegistry }: { llm_properties: llmProperties, character_setting: CharacterSetting, toolRegistry?: ToolRegistry }) {
        this.graph = createGhostGraph() as any;
        this.llm_properties = llm_properties;
        this.character_setting = character_setting;
        this.conversation_count = 0;
        this.toolRegistry = toolRegistry || null;
    }

    async invoke({ input, isSystemMessage }: { input: string, isSystemMessage: boolean }): Promise<GhostResponse> {
        // Wait for any pending summarization to complete before processing new message
        if (this.pendingSummarization) {
            console.log('[Performance] Waiting for pending summarization to complete...');
            await this.pendingSummarization;
        }

        if (!this.agentsInitialized) {
            await this.createAgents();
        }
        this.conversation_count++;
        const userSetting = getUserSetting();
        const chatHistory = getChatHistory(this.character_setting.character_id);

        // Smart tool call detection: skip tool calls for simple conversational messages
        const shouldSkipToolCall = isSystemMessage || !ToolCallDetector.needsToolCall(input);

        if (shouldSkipToolCall && !isSystemMessage) {
            const skipReason = ToolCallDetector.getSkipReason(input);
            console.log(`[Performance] Skipping tool call: ${skipReason || 'No tool keywords detected'}`);
        }

        // Load current skin description for AI context
        const activeSkinId = skinRepository.getActiveSkin(this.character_setting.character_id);
        let skinDescription = 'Standard everyday outfit';

        try {
            const skinManifest = skinRepository.getSkinManifest(this.character_setting.character_id, activeSkinId);
            if (skinManifest && skinManifest.description && skinManifest.description.trim()) {
                skinDescription = skinManifest.description;
            }
            console.log('[Ghost] Skin description:', skinDescription);
        } catch (error) {
            console.warn('[Ghost] Failed to load skin manifest, using default description:', error);
        }

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
            toolCallHistory: [],
            skipToolCall: shouldSkipToolCall,
            toolCallFinalAnswer: '',
            toolCallCompleted: false,
            is_user_update_needed: this.conversation_count % 5 === 0,
            toolAgent: this.toolAgent,
            conversationAgent: this.conversationAgent,
            messageConverter: this.messageConverter,
            currentSkinDescription: skinDescription
        }
        const result = await this.graph.invoke(state);

        // Trigger background summarization after response (non-blocking)
        this.triggerBackgroundSummarization();

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
        const history = new AkagakuChatHistory([], configRepository.getConfig('chatHistoryLimit') as number || 20);
        await updateChatHistory(this.character_setting.character_id, history);
    }

    private async createAgents() {
        const promptForTool = loadToolPrompt();
        const promptForCharacter = loadSystemPrompt(this.llm_properties.llmService);
        this.toolAgent = await createAgentForTool(this.llm_properties, promptForTool, this.toolRegistry);
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
        return await this.invoke({ input: "User is about to quit the application. Say goodbye to the user.", isSystemMessage: true });
    }

    async doChitChat(topicContent?: string) {
        // Default message if no topic provided
        let message = "User has been idle and may not be looking at the screen. You can talk to yourself (monologue) or make a casual comment. Don't expect immediate response.";

        // Use topic content if provided
        if (topicContent) {
            message = `User has been idle and may not be looking at the screen. You can talk to yourself (monologue) or make a casual comment. Don't expect immediate response.\n\nTOPIC: ${topicContent}`;
        }

        return await this.invoke({ input: message, isSystemMessage: true });
    }

    async sendRawMessage({ input, isSystemMessage }: { input: string, isSystemMessage: boolean }) {
        return await this.invoke({ input, isSystemMessage });
    }

    private triggerBackgroundSummarization(): void {
        if (this.summarizationLock) {
            console.log('[Performance] Summarization already in progress, skipping');
            return;
        }

        const chatHistory = getChatHistory(this.character_setting.character_id);
        const enableAutoSummarization = configRepository.getConfig('enableAutoSummarization') !== false;

        if (!enableAutoSummarization) {
            return;
        }

        const summarizationThreshold = configRepository.getConfig('summarizationThreshold') as number || 20;
        const allMessages = chatHistory.getAllMessagesInternal();

        // Find last summary index
        let lastSummaryIndex = -1;
        for (let i = allMessages.length - 1; i >= 0; i--) {
            if (allMessages[i].isSummary === true) {
                lastSummaryIndex = i;
                break;
            }
        }

        const unsummarizedMessages = lastSummaryIndex >= 0
            ? allMessages.slice(lastSummaryIndex + 1)
            : allMessages;

        const unsummarizedCount = unsummarizedMessages.filter(msg => msg.type !== 'system').length;

        if (unsummarizedCount <= summarizationThreshold) {
            return;
        }

        console.log('[Performance] Triggering background summarization');
        this.summarizationLock = true;
        this.pendingSummarization = this.executeBackgroundSummarization()
            .finally(() => {
                this.summarizationLock = false;
                this.pendingSummarization = null;
            });
    }

    private async executeBackgroundSummarization(): Promise<void> {
        try {
            const chatHistory = getChatHistory(this.character_setting.character_id);
            const enableLightweightModel = configRepository.getConfig('enableLightweightModel') !== false;

            const result = await chatHistorySummarizer.summarize(
                chatHistory,
                this.character_setting.name,
                this.llm_properties.llmService,
                this.llm_properties.apiKey,
                this.llm_properties.modelName,
                enableLightweightModel
            );

            if (result) {
                await updateChatHistory(this.character_setting.character_id, result);
            }
        } catch (e) {
            console.error('[Ghost] Background summarization failed:', e);
        }
    }
}