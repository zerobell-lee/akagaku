import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { core_tools } from "../tools/core";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { getChatHistory, updateChatHistory } from "../../infrastructure/chat/ChatHistoryRepository";
import { getCharacterRelationships, updateCharacterRelationships } from "../../infrastructure/user/RelationshipRepository";
import { getUserSetting } from "../../infrastructure/user/UserRepository";
import { CharacterSettingLoader } from "../../infrastructure/character/CharacterRepository";
import { logger } from "../../infrastructure/config/logger";
import { ChatMessageHistory } from "langchain/memory";
import { ChatAnthropic } from "@langchain/anthropic";
interface GhostResponse {
    emoticon: string;
    message: string;
    add_affection: number;
    error?: string;
}

export class ApiKeyNotDefinedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyNotDefinedError';
    }
}

export default class Ghost {
    private systemPrompt: string;
    private prompt: ChatPromptTemplate;
    private executor: AgentExecutor | null;
    private character_name: string;
    private character_setting: any;
    private llmService: string | null;


    constructor({ character_name, llmService, modelName, openaiApiKey, anthropicApiKey, temperature }: { character_name: string, llmService: string | null, modelName: string | null, openaiApiKey: string | null, anthropicApiKey: string | null, temperature: number }) {
        console.log(llmService, modelName, openaiApiKey, anthropicApiKey);
        this.systemPrompt = `
        You're playing as a character role. The character lives in the users' desktop, and can watch users' desktop and what users' do, and communicate with them.
        You will be given interaction data provided by users now. Your job is complete the next conversation. Keep in mind you need to follow context, including character setting, user setting, and background.
        Please provide the answer in raw JSON format string. Don't apply codeblock formatting it in markdown style so that the agent can parse it. keep in mind you need to make a message for user's language.
        
        Use this JSON schema:
        
        Response = {{'emoticon': enum(available_emoticon), 'message': str, 'add_affection': int}}
        Return: Response

        when you make responses, don't leave any comment in your response, so that the agent can parse it.
        Never use '\`\`\`json' or '\`\`\`' in your response.
        
        character's affection is between 0 and 100.
        You'll also be given character's current affection and attitude.
        When you create a message, consider the current affection and attitude.
        
        You can also call other tools if you need to do so. But, keep in mind you need to make a response for user's language even if you call other tools.
        `;
        this.character_name = character_name;

        this.prompt =
            ChatPromptTemplate.fromMessages([
                ["system", this.systemPrompt],
                ["placeholder", "{character_setting}"],
                ["placeholder", "{available_emoticon}"],
                ["placeholder", "{user_setting}"],
                ["placeholder", "{chat_history}"],
                ["placeholder", "{relationship}"],
                ["human", "{input}"],
                ["placeholder", "{agent_scratchpad}"],
            ]);
        this.character_setting = CharacterSettingLoader.getCharacterSetting(character_name);
        this.llmService = llmService;

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

        const agent = createToolCallingAgent({ llm: model, tools: core_tools, prompt: this.prompt });
        this.executor = new AgentExecutor({
            agent: agent,
            tools: core_tools,
        });
    }

    private update_affection = (currentAffection: number, delta: number, affection_factor: number = 0.1) => {
        return Math.max(0, Math.min(100, currentAffection + delta * affection_factor))
    }

    private get_current_attitude = (current_affection: number) => {
        return CharacterSettingLoader.calcAttitude(this.character_name, current_affection);
    }

    async isNewRendezvous() {
        const history = await getChatHistory(this.character_name);
        return (await history.getMessages()).length === 0;
    }

    async invoke({ isSystemMessage = false, input }: { isSystemMessage: boolean, input: string }): Promise<GhostResponse | undefined> {
        if (!this.isExecutorInitialized()) {
            throw new ApiKeyNotDefinedError("API key is not defined");
        }

        let relationship = getCharacterRelationships(this.character_name)
        const history = await getChatHistory(this.character_name);
        let newMessage = null
        if (this.llmService === 'anthropic') {
            let content = input
            if (isSystemMessage) {
                content = `
                ${input}
                And, don't leave any comment in your response, so that the agent can parse it.
                `
            }
            newMessage = new HumanMessage({name: isSystemMessage ? 'system' : 'user', content: content});
        } else {
            newMessage = isSystemMessage ? new SystemMessage(input) : new HumanMessage(input);
        }
        let chatHistory = []
        if (this.llmService === 'openai') {
            chatHistory = await history.getMessages();
        } else if (this.llmService === 'anthropic') {
            console.log('anthropic')
            chatHistory = (await history.getMessages()).filter((message) => message.getType() !== 'system');
        }
        const payload = {
            input: newMessage,
            character_setting: JSON.stringify(this.character_setting),
            user_setting: JSON.stringify(getUserSetting()),
            chat_history: chatHistory,
            available_emoticon: this.character_setting.available_emoticon || '["neutral"]',
            relationship: JSON.stringify(relationship)
        }
        const response = await this.executor.invoke(payload);
        history.addMessage(newMessage);
        try {
            console.log('response', response)
            let properOutput = null
            if (this.llmService === 'anthropic') {
                properOutput = response.output[0].text
            } else {
                properOutput = response.output
            }
            let parsed = null
            parsed = this.extractJsonAndParse(properOutput);
            if (!parsed) {
                throw new Error('Failed to parse response');
            }
            parsed.add_affection = parsed.add_affection;
            const updated_affection = this.update_affection(relationship.affection_to_user, parsed.add_affection);
            relationship = await updateCharacterRelationships(this.character_name, updated_affection, this.get_current_attitude(updated_affection));
            await history.addMessage(new AIMessage(properOutput));
            await updateChatHistory(this.character_name, await this.trimMessage(history));
            return parsed
        } catch (e) {
            console.error(e);
        }
    }

    private extractJsonAndParse = (response: string) => {
        const regex = /{[^]*?}/g;
        const extractedJson = response.match(regex)[0];
        return JSON.parse(extractedJson) as GhostResponse;
    }

    private trimMessage = async (history: ChatMessageHistory) => {
        const messages = await history.getMessages();
        const trimmed = messages.slice(-50);
        await history.clear();
        for (const message of trimmed) {
            await history.addMessage(message);
        }
        return history
    }

    updateExecuter({ openaiApiKey, anthropicApiKey, llmService, modelName, temperature }: { openaiApiKey: string | null, anthropicApiKey: string | null, llmService: string | null, modelName: string | null, temperature: number }) {
        let apiKey = null;
        if (llmService === 'openai' && openaiApiKey) {
            apiKey = openaiApiKey;
        } else if (llmService === 'anthropic' && anthropicApiKey) {
            apiKey = anthropicApiKey;
        }
        this.createExecutor({llmService, modelName, apiKey, temperature});
    }

    getCharacterSize() {
        return { width: 477, height: 768 }
    }

    getTouchableAreas() {
        return CharacterSettingLoader.getTouchableAreas(this.character_name);
    }
}