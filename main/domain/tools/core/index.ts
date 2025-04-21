import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { z } from "zod";
import { updateUserInfo } from "../../../infrastructure/user/UserRepository";
import { shell } from "electron";

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
        return `
        location: Seoul
        temperature: 18
        unit: Celsius
        humidity: 58%
        weather: sunny
        `;
    },
});

const chit_chat = new DynamicTool({
    name: "chit_chat",
    description: "Provide episodes or topics to chit chat with user. Don't use this tool if user met you for the first time.",
    func: async () => {
        const topics = [
            "캐릭터는 한 때 자캐대회라 불리는 대회를 개최한 적이 있으며, 그곳에서 무소불위의 권력을 휘둘렀다. 지금 생각해보면 피곤하기도 하지만, 좋았던 경험으로 남아있다",
            "캐릭터는 늦잠을 자는 편이고, 밤에 늦게 잠든다.",
            "캐릭터는 커피를 도대체 무슨 맛으로 마시는지 모른다고 한다. 가끔씩 마시지만, 결국엔 머리가 아파와서 늘 후회한다.",
            "캐릭터가 좋아하는 음악은 힙합이다. 하지만 유교걸이라서 가사의 수위가 강한 노래는 좋아하지 않는다.",
            "캐릭터는 롤(League of Legends)을 좋아해서 자주 한다. 하지만 부끄러운지 티어를 공개하지는 않는다."
        ];
        const randomIndex = Math.floor(Math.random() * topics.length);
        return topics[randomIndex];
    },
});

const update_user_info = new DynamicStructuredTool({
    name: "update_user_info",
    description: "Update user info. When you got any new information about user, you can update user info using this tool.",
    schema: z.object({
        key: z.string(),
        value: z.string(),
    }),
    func: async ({ key, value }) => {
        return updateUserInfo(key, value);
    },
});

const get_installed_apps = new DynamicTool({
    name: "get_installed_apps",
    description: "Get installed apps and path of the apps on user's device",
    func: async () => {
        return "This tool is not implemented yet.";
    },
});


const open_app = new DynamicTool({
    name: "open_app",
    description: "Open the app with the given path",
    func: async (arg) => {
        const { exec } = require('child_process');
        exec(`start "" "${arg.replace(/\\/g, '\\\\')}"`, (err) => {
            if (err) {
                console.error(err);
                return "Failed to open the app. error: " + err;
            }
            console.log(`Opening ${arg}`);
        });
        return `Opening ${arg}`;
    },
});

const ingsfriends_open = new DynamicTool({
    name: "ingsfriends_open",
    description: "잉친쓰를 열 수 있는 tool",
    func: async () => {
        shell.openExternal('https://cafe.naver.com/ingsfriends');
        return "잉친쓰를 열었습니다.";
    },
});

const get_schedule = new DynamicTool({
    name: "get_schedule",
    description: "Get schedule of the user",
    func: async () => {
        return `
        It is 22:55, 2025-04-20.
        Upcoming tasks:
        - 23:30 ~ 24:00 -> 화상영어
        - 24:00 ~ 24:30 -> 우정잉 방송 끝나고 캡처 따기
        - 24:30 ~ 26:00 -> 친구들과 몬스터헌터
        `;
    },
});

const open_friendshiping_streaming = new DynamicTool({
    name: "open_friendshiping_streaming",
    description: "우정잉 방송을 열 수 있는 tool",
    func: async () => {
        shell.openExternal('https://play.sooplive.co.kr/nanajam/283260760');
        return "우정잉 방송을 열었습니다.";
    },
});

export const core_tools = [timeTool, get_weather, chit_chat, update_user_info, get_installed_apps, open_app, ingsfriends_open, open_friendshiping_streaming, get_schedule];