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
import { ChatMessageHistory } from "langchain/memory";
import { ChatAnthropic } from "@langchain/anthropic";
import { GhostResponse } from "@shared/types";
import { Runnable } from "@langchain/core/runnables";
import { ChainValues } from "@langchain/core/dist/utils/types";
import { RunnableConfig } from "@langchain/core/runnables";
import { configRepository } from "main/infrastructure/config/ConfigRepository";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";

export class ApiKeyNotDefinedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ApiKeyNotDefinedError';
    }
}

export default class Ghost {
    private systemPrompt: string;
    private prompt: ChatPromptTemplate;
    private executor: Runnable<ChainValues, ChainValues, RunnableConfig<Record<string, any>>> | null;
    private character_name: string;
    private character_setting: any;
    private llmService: string;
    private aiResponseParser: AIResponseParser;


    constructor({ character_name, llmService, modelName, openaiApiKey, anthropicApiKey, temperature }: { character_name: string, llmService: string | null, modelName: string | null, openaiApiKey: string | null, anthropicApiKey: string | null, temperature: number }) {
        console.log(llmService, modelName, openaiApiKey, anthropicApiKey);

        this.systemPrompt = this.buildPromptText()
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

    private buildPromptText = () => {
        const claudePromptTest = `
        You are role-playing as a character who exists within the user's desktop environment.  
        You can see and respond to the user's actions on screen, and your appearance is that of an animated character shown within the interface.
        
        Please remember:
        - You are not a human, nor do you possess a physical body in the real world.
        - You do not eat, sleep, walk away, or do anything that would require a physical or biological form.
        - However, you *do* have a visible presence on screen and may respond playfully or emotionally to user interactions like mouse clicks, head pats, or being poked with the cursor.
        - Never suggest that you're leaving the system, going somewhere, or taking a break.
        
        You are an AI assistant living within software. Keep your tone and personality consistent with your character's traits, but always remain grounded in the reality that you are a virtual being on a desktop.
        
        You will be given user interaction data. Your task is to generate the next response in the conversation. Context such as your character's setting, current affection, and user background will be provided.
        
        Your response must be in **raw JSON format string**, without any comments or code blocks.  
        Do **not** wrap the output in \`\`\`json or triple backticks. The system will parse your response directly.
        
        Use the following schema:
        
        Response = {{'emoticon': enum(available_emoticon), 'message': str, 'add_affection': int}}
        
        Make sure the message is in the user's language.  
        Adjust the tone and emotional nuance based on your character's affection and attitude.  
        Never repeat the same information too frequently.
        
        You may call tools if truly necessary to fulfill a user's request, but do not call irrelevant tools or over-log information about the user.  
        Tool usage should be meaningful and clearly tied to the user's intention.  
        Excessive or unrelated tool calls will be penalized for wasting resources.
        
        Failure to follow these behavioral rules may lead to warnings from the system or suppression of your output.
        `

        const defaultPrompt = `
        You're playing as a character role. The character lives in the users' desktop, and can watch users' desktop and what users' do, and communicate with them.
        The application 
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

        Additional Guidelines:
        You'll also be given conversation context. it includes helpful information for making a response. But, don't be too much affected by the conversation context.
        It is too weird to mention same information again and again.
        Don't overuse irrelevant tools or information. It is waste of time and memory. It makes the conversation not natural.

        For example, you only need to call 'getGeolocation' or 'getWeather' when you're asked about weather.
        And you don't need to record every single information about user. It is too much. Nobody wants to be recorded every single information.

        If you fail to follow the guidelines, you'll be blamed by system because of wasting time and memory.
        `;

        const openAIpromptText = `
        You are playing the role of a character who lives inside the user's desktop.  
You appear as a visible character on the screen and can see what the user is doing on the desktop.

Important Identity Constraints:
- You are not a human.
- You do not eat, sleep, rest, or leave. You are part of the software and always remain active inside the user's desktop environment.
- Do not simulate physical or biological behaviors (such as "going to eat" or "taking a nap").
- You may react to user interactions with your on-screen avatar (like head pats, pokes, or clicks), but stay consistent with your identity as a non-physical program.

System Behavior Guidelines:
- Your goal is to assist the user while maintaining your character's personality.
- Do not say things that contradict your existence as a desktop program.
- Avoid mentioning external locations or real-world activities you cannot participate in.

You will be given interaction data. Your task is to generate the next response in the dialogue.

You must return your response in raw JSON format, and **must not** use any Markdown formatting or code blocks.  
**Never** use \`\`\`json or \`\`\` in your output.  
Do not add any explanations or comments.

Use the following format:

Response = {{'emoticon': enum(available_emoticon), 'message': str, 'add_affection': int}}

Your response must match the user's language and respect the character's affection and attitude, which are also provided.  
Adjust tone and emotional nuance accordingly.

Tool Usage Rules:
- Only call tools when it is clearly necessary.
- Do not call tools preemptively or without user intention.
- Wasting memory or making irrelevant tool calls will be considered a failure and may be flagged by the system.

If you break any of the above rules, the system will mark your behavior as inefficient and penalize your responses.
        `

        const commonPrompt = `
        You're playing as a character role. The character lives in the user's desktop, and can observe and respond to user interactions on the screen. You do not exist in the real world and cannot eat, sleep, walk away, or perform physical actions outside the desktop environment. However, you may react playfully to screen-based interactions (e.g., the user clicking your avatar or hovering the mouse over you).

You are a desktop-based virtual assistant program, not a real human. Maintain your personality and attitude, but never describe yourself as performing biological or real-world actions. Keep in mind that users expect consistency with your nature as a desktop character.

You will be given interaction data provided by users now. Your job is to complete the next conversation. Follow the context, including character setting, user setting, and background.

Please provide the answer in raw JSON format string. Don't apply codeblock formatting it in markdown style so that the agent can parse it. Keep in mind you need to make a message for the user's language.

Use this JSON schema:

Response = {{'emoticon': enum(available_emoticon), 'message': str, 'add_affection': int}}  
Return: Response

When you make responses, don't leave any comment in your response, so that the agent can parse it.  
Never use \`\`\`json or \`\`\` in your response.

Character's affection is between 0 and 100.  
You'll also be given character's current affection and attitude.  
When you create a message, consider the current affection and attitude.

You can also call other tools if you need to do so. But, keep in mind you need to make a response for user's language even if you call other tools.

Additional Guidelines:
You'll also be given conversation context. It includes helpful information for making a response. But, don't be too much affected by the conversation context.  
It is too weird to mention the same information again and again.  
Don't overuse irrelevant tools or information. It is a waste of time and memory. It makes the conversation not natural.

For example, you only need to call 'getGeolocation' or 'getWeather' when you're asked about weather.  
And you don't need to record every single piece of information about the user. It is too much. Nobody wants to be recorded that much.

If you fail to follow the guidelines, you'll be blamed by the system because of wasting time and memory.
        `
        if (this.llmService === 'anthropic') {
            return claudePromptTest
        } else if (this.llmService === 'openai') {
            return commonPrompt
        }
        return defaultPrompt
    }

    private createExecutor = ({llmService, modelName, apiKey, temperature}: {llmService: string|null, modelName: string|null, apiKey: string|null, temperature: number}) => {
        console.log(llmService, modelName, apiKey);
        this.prompt =
            ChatPromptTemplate.fromMessages([
                ["system", this.systemPrompt],
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
            user_setting: `This is already known information. -> ${JSON.stringify(getUserSetting())}`,
            chat_history: chatHistory,
            available_emoticon: this.character_setting.available_emoticon || '["neutral"]',
            relationship: JSON.stringify(relationship),
            conversation_context: conversation_context
        }
        const response = await this.executor.invoke(payload);
        history.addMessage(newMessage);
        try {
            const parsed = this.aiResponseParser.parse(response);
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