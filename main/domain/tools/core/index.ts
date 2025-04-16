import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { z } from "zod";
import { updateUserInfo } from "../../../infrastructure/user/UserRepository";
import { shell } from "electron";
import { configRepository } from "../../../infrastructure/config/ConfigRepository";

const get_weather = new DynamicStructuredTool({
    name: "get_weather",
    description: "return current weather of given location. It takes so long time to get the weather of user's location. So, use this tool only when user asked you about weather.",
    schema: z.object({
        latitude: z.number(),
        longitude: z.number(),
    }),
    func: async ({ latitude, longitude }) => {
        const apiKey = await configRepository.getConfig("openweathermapApiKey");
        if (!apiKey || apiKey === "") {
            return "OpenWeatherMap API key is not set. You need to explain user to set it in the config by himself.";
        }
        const response = await fetch(`http://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${apiKey}&units=metric`);
        const data = await response.json();
        return `
        temperature: ${data.main.temp}
        unit: Celsius
        humidity: ${data.main.humidity}%
        weather: ${data.weather[0].main}, ${data.weather[0].description}
        `;
    },
});

const get_geolocation = new DynamicStructuredTool({
    name: "get_geolocation",
    description: "return current geolocation of user. Use this only when user asked you about it. Unless, it is violating the guidelines.",
    schema: z.object({
        location: z.string(),
    }),
    func: async ({ location }) => {
        const apiKey = await configRepository.getConfig("openweathermapApiKey");
        if (!apiKey || apiKey === "") {
            return "OpenWeatherMap API key is not set. You need to explain user to set it in the config by himself.";
        }
        const response = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${location}&limit=5&appid=${apiKey}`);
        const data = await response.json();
        return `
        location: ${data[0].name}, latitude: ${data[0].lat}, longitude: ${data[0].lon}
        `;
    },
});

const getAnyCharacterEpisode = new DynamicTool({
    name: "getAnyCharacterEpisode",
    description: "Get any episode of the character. It is not necessary to use this tool every time you chit chat with user.",
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
    description: `When you got new important information about user (such as user's name, age, etc.),
    you can update user info using this tool. NEVER use this tool if you got any information about user's daily life or trivial information. It is waste of time and memory to update user info every time.
    For example, these types of information are recommended to be updated:
    - user's name
    - user's age
    - user's location
    - user's nickname preference
    - user's occupation
    - user's hobby

    Otherwise, these types of information are NOT recommended to be updated:
    - user's affection score
    - user's attitude
    - user's current time
    - user's last action
    - user's feelings
    `,
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

const openUrl = new DynamicTool({
    name: "openUrl",
    description: "Open the url in the browser or shell command",
    func: async (url: string) => {
        shell.openExternal(url);
        return `Opened ${url}`;
    },
});

const getBookmarks = new DynamicTool({
    name: "getBookmarks",
    description: "Get bookmarks of the user. If user say like '열어줘', you can use this tool to open the bookmark.",
    func: async () => {
        return `
        - 네이버 : https://naver.com
        - 구글 : https://google.com
        - 유튜브 : https://youtube.com
        - 잉친쓰(우정잉 팬카페) : https://cafe.naver.com/ingsfriends
        - 블로그 : https://seolin.tistory.com
        - 우정잉 방송 : https://play.sooplive.co.kr/nanajam/283260760
        `;
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

export const core_tools = [get_weather, get_geolocation, getAnyCharacterEpisode, update_user_info, get_installed_apps, open_app, openUrl, getBookmarks, get_schedule];