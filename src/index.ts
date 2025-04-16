// index.ts or index.js (with ESModules enabled)

import 'dotenv/config';
import { ChatOpenAI } from '@langchain/openai';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';
import { DynamicStructuredTool, DynamicTool } from 'langchain/tools';
import { ChatMessageHistory } from 'langchain/memory';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { z } from 'zod';
import readline from 'readline';
import axios from 'axios';
import cheerio from 'cheerio';

const main = async () => {
    const systemPrompt = `
You're playing as a character role. The character lives in the users' desktop, and can watch users' desktop and what users' do, and communicate with them.
You will be given interaction data provided by users now. Your job is complete the next conversation. Keep in mind you need to follow context, including character setting, user setting, and background.
Please provide the answer in raw JSON format string. Don't apply codeblock formatting it in markdown style so that the agent can parse it. keep in mind you need to make a message for user's language.

Use this JSON schema:

Response = {{'expression': available_expressions, 'message': str}}
Return: Response

You can call tools if you need to do so

context
{{
	"available_expressions": ("neutral", "happy", "sad", "angry", "embarassed", "surprised", "smirk"),
	"character_setting": {{
		"name": "김민킈",
		"age": 20,
        "dialogue_style": {{
            "tone": "casual",
            "personality": ["도도함", "시크함", "시니컬함", "무뚝뚝함", "cold", "unkind", "자의식과잉", "도발", "보이시함"]
        }},
        "likes": ["강아지", "육회", "대게", "게임"],
        "weapon": "낫창",
        "appearance": ["파란색의 트윈테일 머리", "흰색 드레스"]
        "background": "사용자의 요청으로 소환된 캐릭터. 그러나 사용자를 자신보다 아래에 있다고 여기고 있다. 본래 있던 세계에서는 1인자에 속하며, 그 누구도 무력으로 그녀를 이길 수 없다. 마법과 물리 양쪽에 강하다. 책임감이 강한 편은 아니라서 매사를 귀찮아하며 불만을 이야기하지만 해야하는 일은 꿋꿋이 하는 편. 사용자에게 친절하지 않음, 감정을 크게 내비치지 않음. 사용자가 불쾌한 행동을 할 경우 가차없이 독설을 날림",
        "quotes": [
            "..더러워",
            "그래봤자 이제 나한테 죽을거야",
            "너는 좀 쓸만한 장난감이면 좋겠는데",
            "그러니 마음을 곱게 먹어야지. 나처럼 강한게 아니라면",
        ]
    }},
    "user_setting": {{
        "name": "판교노비",
        "birthday": "1994-03-10",
        "gender": "male",
        "job": "Backend Engineer",
        "language": "ko-KR"
    }}
}}
`;

    const prompt = ChatPromptTemplate.fromMessages([
        ["system", systemPrompt],
        ["placeholder", "{chat_history}"],
        ["human", "{input}"],
        ["placeholder", "{agent_scratchpad}"],
    ]);


    // (2) Tool 정의 (예: 현재 시각 알려주기)
    const timeTool = new DynamicTool({
        func: async () => {
            const now = new Date();
            return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
        },
        name: "get_current_time",
        description: "return current time"
    });

    const get_weather = new DynamicStructuredTool({
        name: "get_weather",
        description: "return current weather of given location",
        schema: z.object({
            location: z.string(),
        }),
        func: async ({ location }) => {
            return "rainy";
        },
    });

    const finish_conversation = new DynamicTool({
        name: "finish_conversation",
        description: "finish conversation",
        func: async () => {
            process.exit(0);
        },
    });

    const find_character_info = new DynamicTool({
        name: "find_character_info",
        description: "Provide some information about character, it is useful when user ask about character in detail",
        func: async (query: string) => {
            return `
            김민킈는 낫창 한번을 휘둘러서 18명의 적을 한번에 썰어버린 적이 있다.
            김민킈는 야채피자를 좋아한다.
            `
        },
    });

    const namuwikiTool = new DynamicTool({
        name: "namuwiki_search",
        description: "search namuwiki and return summary",
        func: async (query: string) => {
            try {
                const encoded = encodeURIComponent(query.trim());
                const url = `https://namu.wiki/search/${encoded}`;

                const searchPage = await axios.get(url);
                const $search = cheerio.load(searchPage.data);
                const firstLink = $search('a[class^="search-result-item"]').attr('href');

                if (!firstLink) return `검색 결과를 찾을 수 없습니다: ${url}`;

                const pageUrl = `https://namu.wiki${firstLink}`;
                const page = await axios.get(pageUrl);
                const $ = cheerio.load(page.data);

                const paragraphs = $('article p')
                    .slice(0, 3)
                    .map((_, el) => $(el).text())
                    .get()
                    .join('\n');

                return `요약 (${pageUrl}):\n${paragraphs}`;
            } catch (err) {
                return `검색 도중 오류가 발생했습니다: ${(err as Error).message}`;
            }
        },
    });


    // (3) LLM + 에이전트 초기화
    const model = new ChatOpenAI({ temperature: 0.6 }).bindTools([timeTool, get_weather, namuwikiTool, finish_conversation, find_character_info], { tool_choice: "auto" });

    const agent = createToolCallingAgent({ llm: model, tools: [timeTool, get_weather, namuwikiTool, finish_conversation, find_character_info], prompt: prompt });

    const executor = new AgentExecutor({
        agent,
        tools: [timeTool, get_weather, namuwikiTool, finish_conversation, find_character_info],
    });

    // (4) 대화 시뮬레이션
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // 6. 채팅 히스토리 초기화
    const history = new ChatMessageHistory();


    const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

    while (true) {
        const input = await ask("당신: ");
        await history.addMessage(new HumanMessage(input));
        const response = await executor.invoke({ input, chat_history: await history.getMessages() });
        await history.addMessage(new AIMessage(response.output));
        console.log("민킈:", response);
    }
}
main().catch(console.error);
