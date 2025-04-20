import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { z } from "zod";
import { updateUserInfo } from "../../user/UserRepository";

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
        return "Failed to get weather. API key is not set. Please guide user to set API key in the app config.";
    },
});

const chit_chat = new DynamicTool({
    name: "chit_chat",
    description: "Provide episodes or topics to chit chat with user. Don't use this tool if user met you for the first time.",
    func: async () => {
        const topics = [
            "캐릭터는 한 때 자캐대회라 불리는 대회를 개최한 적이 있으며, 그곳에서 무소불위의 권력을 휘둘렀다. 지금 생각해보면 피곤하기도 하지만, 좋았던 경험으로 남아있다",
            "캐릭터는 늦잠을 자는 편이고, 밤에 늦게 잠든다.",
            "캐릭터는 커피를 도대체 무슨 맛으로 마시는지 모른다고 한다. 가끔씩 마시지만, 결국엔 머리가 아파와서 늘 후회한다."
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

export const core_tools = [timeTool, get_weather, chit_chat, update_user_info];