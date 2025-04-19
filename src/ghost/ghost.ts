import { ChatOpenAI } from "@langchain/openai";
import { createToolCallingAgent } from "langchain/agents";
import { AgentExecutor } from "langchain/agents";
import { core_tools } from "../tools/core";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { getChatHistory, updateChatHistory } from "../chat/ChatHistoryRepository";
import { getCharacterRelationships, updateCharacterRelationships } from "../user/RelationshipRepository";
import { getUserSetting } from "../user/UserRepository";
import { getCharacterSetting } from "../character/CharacterRepository";

interface GhostResponse {
    emoticon: string;
    message: string;
    add_affection: number;
}

export default class Ghost {
    private systemPrompt: string;
    private prompt: ChatPromptTemplate;
    private executor: AgentExecutor;
    private character_name: string;
    private character_setting: any;

    constructor(character_name: string) {
        this.systemPrompt = `
        You're playing as a character role. The character lives in the users' desktop, and can watch users' desktop and what users' do, and communicate with them.
        You will be given interaction data provided by users now. Your job is complete the next conversation. Keep in mind you need to follow context, including character setting, user setting, and background.
        Please provide the answer in raw JSON format string. Don't apply codeblock formatting it in markdown style so that the agent can parse it. keep in mind you need to make a message for user's language.
        
        Use this JSON schema:
        
        Response = {{'emoticon': enum(available_emoticon), 'message': str, 'add_affection': int}}
        Return: Response
        
        character's affection is between 0 and 100.
        When you create a message, you need to consider the current affection and attitude.
        
        You can also call other tools if you need to do so.
        `;
        this.character_name = character_name;

        const model = new ChatOpenAI({ temperature: 0.7, modelName: "gpt-4o" }).bindTools(core_tools);

        this.prompt =
            ChatPromptTemplate.fromMessages([
                ["system", this.systemPrompt],
                ["placeholder", "{character_setting}"],
                ["placeholder", "{user_setting}"],
                ["placeholder", "{chat_history}"],
                ["placeholder", "{relationship}"],
                ["human", "{input}"],
                ["placeholder", "{agent_scratchpad}"],
            ]);

        const agent = createToolCallingAgent({ llm: model, tools: core_tools, prompt: this.prompt });

        this.executor = new AgentExecutor({
            agent: agent,
            tools: core_tools,
        });

        this.character_setting = getCharacterSetting(character_name);
    }

    private update_affection = (currentAffection: number, delta: number, affection_factor: number = 0.1) => {
        return Math.max(0, Math.min(100, currentAffection + delta * affection_factor))
    }

    private get_current_attitude = (current_affection: number) => {
        if (current_affection >= 80) return "유저에게 우호적인";
        if (current_affection >= 50) return "neutral";
        return "유저에게 적대적인";
    }

    async isNewRendezvous() {
        const history = await getChatHistory(this.character_name);
        return (await history.getMessages()).length === 0 && Object.keys(getUserSetting()).length === 0;
    }

    async invoke({ isSystemMessage = false, input }: { isSystemMessage: boolean, input: string }): Promise<GhostResponse | undefined> {
        let relationship = getCharacterRelationships(this.character_name)
        const history = await getChatHistory(this.character_name);
        const newMessage = isSystemMessage ? new SystemMessage(input) : new HumanMessage(input);
        const payload = {
            input: newMessage,
            character_setting: JSON.stringify(this.character_setting),
            user_setting: JSON.stringify(getUserSetting()),
            chat_history: await history.getMessages(),
            relationship: JSON.stringify(relationship)
        }
        const response = await this.executor.invoke(payload);
        history.addMessage(newMessage);
        try {
            const parsed = JSON.parse(response.output) as GhostResponse;
            parsed.add_affection = parsed.add_affection;
            const updated_affection = this.update_affection(relationship.affection_to_user, parsed.add_affection);
            relationship = await updateCharacterRelationships(this.character_name, updated_affection, this.get_current_attitude(updated_affection));
            await history.addMessage(new AIMessage(response.output));
            await updateChatHistory(this.character_name, history);
            return parsed
        } catch (e) {
            console.error(e);
        }
    }
}