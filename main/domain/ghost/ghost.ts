import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { core_tools } from "../tools/core";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SystemMessage, HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { AkagakuChatHistory, getChatHistory, updateChatHistory } from "../../infrastructure/chat/ChatHistoryRepository";
import { getCharacterRelationships, updateCharacterRelationships } from "../../infrastructure/user/RelationshipRepository";
import { getUserSetting } from "../../infrastructure/user/UserRepository";
import { CharacterSettingLoader } from "../../infrastructure/character/CharacterRepository";
import { logger } from "../../infrastructure/config/logger";
import { ChatAnthropic } from "@langchain/anthropic";
import { GhostResponse } from "@shared/types";
import { Runnable } from "@langchain/core/runnables";
import { ChainValues } from "@langchain/core/dist/utils/types";
import { RunnableConfig } from "@langchain/core/runnables";
import { configRepository } from "main/infrastructure/config/ConfigRepository";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { loadSystemPrompt } from "./prompt";

export class ApiKeyNotDefinedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyNotDefinedError';
    }
}

export default class Ghost {
    private prompt: ChatPromptTemplate;
    private executor: Runnable<ChainValues, ChainValues, RunnableConfig<Record<string, any>>> | null;
    private character_name: string;
    private character_setting: any;
    private llmService: string;
    private aiResponseParser: AIResponseParser;


    constructor({ character_name, llmService, modelName, openaiApiKey, anthropicApiKey, temperature }: { character_name: string, llmService: string | null, modelName: string | null, openaiApiKey: string | null, anthropicApiKey: string | null, temperature: number }) {
        console.log(llmService, modelName, openaiApiKey, anthropicApiKey);

        
        this.character_name = character_name;
        this.character_setting = CharacterSettingLoader.getCharacterSetting(character_name);
        this.llmService = llmService;
        this.aiResponseParser = new AIResponseParser(llmService);

        let apiKey = null;
        if (llmService === 'openai') {
            apiKey = openaiApiKey;
        } else if (llmService === 'anthropic') {
            apiKey = anthropicApiKey;
        }
        this.createExecutor({llmService: llmService, modelName: modelName, apiKey: apiKey, temperature: temperature});
    }

    private isExecutorInitialized() {
        return this.executor !== null && this.executor !== undefined;
    }

    private createExecutor = ({llmService, modelName, apiKey, temperature}: {llmService: string|null, modelName: string|null, apiKey: string|null, temperature: number}) => {
        console.log(llmService, modelName, apiKey);
        this.prompt =
            ChatPromptTemplate.fromMessages([
                ["system", loadSystemPrompt(llmService)],
                ["placeholder", "{character_setting}"],
                ["placeholder", "{available_emoticon}"],
                ["placeholder", "{user_setting}"],
                ["placeholder", "{chat_history}"],
                ["placeholder", "{relationship}"],
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

        console.log(model === null);
        
        if (!model) {
            return;
        }

        this.llmService = llmService;
        this.aiResponseParser = new AIResponseParser(llmService);
        const agent = createToolCallingAgent({ llm: model, tools: core_tools, prompt: this.prompt });
        this.executor = new AgentExecutor({
            agent: agent,
            tools: core_tools,
        }).withConfig({
            runName: "ghost"
        });
    }

    private update_affection = (currentAffection: number, delta: number, affection_factor: number = 0.1) => {
        return Math.max(0, Math.min(100, currentAffection + delta * affection_factor))
    }

    private get_current_attitude = (current_affection: number) => {
        return CharacterSettingLoader.calcAttitude(this.character_name, current_affection);
    }

    isNewRendezvous() {
        const history = getChatHistory(this.character_name);
        return history.getMessages().length === 0;
    }

    private buildConversationContext = () => {

        return `
        This information in adhoc context. It is not necessary to be considered in the conversation.
        `;
    }

    private getCurrentTimestamp = (now: Date) => {
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const amOrPm = hours >= 12 ? 'PM' : 'AM';
        const formattedHours = hours % 12 || 12;
        const dataTimeString = `${formattedHours}:${minutes} ${amOrPm}, ${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
        return dataTimeString;
    }

    async invoke({ isSystemMessage = false, input }: { isSystemMessage: boolean, input: string }): Promise<GhostResponse | undefined> {
        if (!this.isExecutorInitialized()) {
            throw new ApiKeyNotDefinedError("API key is not defined");
        }

        const sentAt = new Date();
        const currentTimestamp = this.getCurrentTimestamp(sentAt);
        const sentAtString = formatDatetime(sentAt);
        let relationship = getCharacterRelationships(this.character_name)
        const history = await getChatHistory(this.character_name);
        let newMessage: {timestamp: string, message: BaseMessage} | null = null
        let content = `${currentTimestamp}| ${input}`
        if (this.llmService === 'anthropic') {
            if (isSystemMessage) {
                content = `
                ${currentTimestamp}| ${input}
                And, don't leave any comment in your response, so that the agent can parse it.
                `
            }
            newMessage = {timestamp: sentAtString, message: new HumanMessage({name: isSystemMessage ? 'system' : 'user', content: content})};
        } else {
            newMessage = {timestamp: sentAtString, message: isSystemMessage ? new SystemMessage(content) : new HumanMessage(content)};
        }
        let chatHistory: BaseMessage[] = history.getMessages().map(({message}) => (message));
        if (this.llmService === 'anthropic') {
            chatHistory = chatHistory.filter((message) => message.getType() !== 'system');
        }

        const conversation_context = this.buildConversationContext();
        const payload = {
            input: newMessage.message,
            character_setting: JSON.stringify(this.character_setting),
            user_setting: JSON.stringify(getUserSetting()),
            chat_history: chatHistory,
            available_emoticon: this.character_setting.available_emoticon || '["neutral"]',
            relationship: JSON.stringify(relationship),
            conversation_context: conversation_context
        }
        const response = await this.executor.invoke(payload);
        history.addMessage(newMessage);
        try {
            
            const parsed = this.aiResponseParser.parseGhostResponse(response);
            console.log('response', response)
            if (!parsed) {
                throw new Error('Failed to parse response');
            }
            parsed.add_affection = parsed.add_affection;
            const updated_affection = this.update_affection(relationship.affection_to_user, parsed.add_affection);
            relationship = await updateCharacterRelationships(this.character_name, updated_affection, this.get_current_attitude(updated_affection));
            const receivedAt = new Date();
            const receivedAtString = formatDatetime(receivedAt);
            history.addMessage({message: new AIMessage(JSON.stringify(parsed)), timestamp: receivedAtString});
            await updateChatHistory(this.character_name, history);
            return parsed
        } catch (e) {
            console.error(e);
        }
    }

    updateExecuter({ openaiApiKey, anthropicApiKey, llmService, modelName, temperature }: { openaiApiKey: string | null, anthropicApiKey: string | null, llmService: string | null, modelName: string | null, temperature: number }) {
        let apiKey = null;
        if (llmService === 'openai' && openaiApiKey !== null && openaiApiKey !== "") {
            apiKey = openaiApiKey;
        } else if (llmService === 'anthropic' && anthropicApiKey !== null && anthropicApiKey !== "") {
            apiKey = anthropicApiKey;
        }
        this.createExecutor({llmService, modelName, apiKey, temperature});
    }

    async resetChatHistory() {
        const history = new AkagakuChatHistory([], configRepository.getConfig('chatHistoryLimit') as number || 100);
        await updateChatHistory(this.character_name, history);
    }

    getChatHistory(): AkagakuChatHistory {
        return getChatHistory(this.character_name);
    }
}