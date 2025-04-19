// index.ts or index.js (with ESModules enabled)

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';

import readline from 'readline';

import fs from 'fs';
import yaml from 'js-yaml';
import { getUserSetting } from './user/UserRepository';
import { core_tools } from './tools/core';
import { getChatHistory, updateChatHistory } from './chat/ChatHistoryRepository';
import { getCharacterRelationships, updateCharacterRelationships } from './user/RelationshipRepository';

const isDev = process.env.NODE_ENV !== 'development';
const character_setting = yaml.load(fs.readFileSync('data/character/hasty.yaml', 'utf8'));
const user_setting = getUserSetting();

const character_name = "hasty";

const main = async () => {
    const systemPrompt = `
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

    const model = new ChatOpenAI({ temperature: 0.7, modelName: "gpt-4o" }).bindTools(core_tools);

    const prompt =
        ChatPromptTemplate.fromMessages([
            ["system", systemPrompt],
            ["placeholder", "{character_setting}"],
            ["placeholder", "{user_setting}"],
            ["placeholder", "{chat_history}"],
            ["placeholder", "{relationship}"],
            ["human", "{input}"],
            ["placeholder", "{agent_scratchpad}"],
        ]);

    const agent = createToolCallingAgent({ llm: model, tools: core_tools, prompt: prompt });

    const executor = new AgentExecutor({
        agent,
        tools: core_tools,
    });

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const history = await getChatHistory(character_name);


    const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

    let relationship = getCharacterRelationships(character_name)

    const get_current_attitude = (current_affection: number) => {
        if (current_affection >= 80) return "유저에게 우호적인";
        if (current_affection >= 50) return "neutral";
        return "유저에게 적대적인";
    }

    const update_affection = (currentAffection: number, delta: number, affection_factor: number = 0.1) => {
        return Math.max(0, Math.min(100, currentAffection + delta * affection_factor))
    }

    const invokeToAgent = async ({ isSystemMessage = false, input }: { isSystemMessage: boolean, input: string }) => {
        const payload = {
            input: isSystemMessage ? new SystemMessage(input) : new HumanMessage(input),
            character_setting: JSON.stringify(character_setting),
            user_setting: JSON.stringify(user_setting),
            chat_history: await history.getMessages(),
            relationship: JSON.stringify(relationship)
        }
        return executor.invoke(payload);
    }

    let welcomeMessage = undefined;
    if ((await history.getMessages()).length === 0 && Object.keys(user_setting).length === 0) {
        welcomeMessage = await invokeToAgent({ isSystemMessage: true, input: "This is your first time to talk to the user. Please introduce yourself and gather user's information. Call 'update_user_info' tool if you need to store user's information." });
    } else {
        welcomeMessage = await invokeToAgent({ isSystemMessage: true, input: "User's PC booted up." });
    }

    console.log("캐릭터 :", welcomeMessage);
    while (true) {
        const input = await ask("당신: ");
        await history.addMessage(new HumanMessage(input));
        const response = await invokeToAgent({ isSystemMessage: false, input });
        try {
            const parsed = JSON.parse(response.output);
            parsed.add_affection = parseInt(parsed.add_affection);
            const updated_affection = update_affection(relationship.affection_to_user, parsed.add_affection);
            relationship = await updateCharacterRelationships(character_name, updated_affection, get_current_attitude(updated_affection));
        } catch (e) {
            console.error(e);
        }
        await history.addMessage(new AIMessage(response.output));
        console.log("캐릭터 :", response);
        await updateChatHistory(character_name, history);
    }
}
main().catch(console.error);
