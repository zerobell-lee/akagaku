import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { z } from "zod";
import { updateUserInfo } from "../../../infrastructure/user/UserRepository";
import { shell } from "electron";
import { configRepository } from "../../../infrastructure/config/ConfigRepository";
import { headers } from "next/headers";

const get_weather = new DynamicStructuredTool({
    name: "get_weather",
    description: "return current weather of given location. It takes so long time to get the weather of user's location. So, use this tool only when user asked you about weather.",
    schema: z.object({
        location: z.string(),
    }),
    func: async ({ location }) => {
        const apiKey = await configRepository.getConfig("openweathermapApiKey");
        if (!apiKey || apiKey === "") {
            return "OpenWeatherMap API key is not set. You need to explain user to set it in the config by himself.";
        }
        const geoLocationResponse = await fetch(`http://api.openweathermap.org/geo/1.0/direct?q=${location}&limit=5&appid=${apiKey}`);
        const geoLocationData = await geoLocationResponse.json();
        const weatherResponse = await fetch(`http://api.openweathermap.org/data/2.5/weather?lat=${geoLocationData[0].lat}&lon=${geoLocationData[0].lon}&appid=${apiKey}&units=metric`);
        const weatherData = await weatherResponse.json();
        return `
        location: ${geoLocationData[0].name}, latitude: ${geoLocationData[0].lat}, longitude: ${geoLocationData[0].lon}
        temperature: ${weatherData.main.temp}
        unit: Celsius
        humidity: ${weatherData.main.humidity}%
        weather: ${weatherData.weather[0].main}, ${weatherData.weather[0].description}
        `;
    },
});

export const update_user_info = new DynamicStructuredTool({
    name: "update_user_setting",
    description: `Use this tool when you got new important information about user (such as user's name, age, etc.)`,
    schema: z.object({
        keyValues: z.array(z.object({
            key: z.string(),
            value: z.string(),
        })).describe("key-value pairs of user info to update"),
    }),
    func: async ({ keyValues }) => {
        for (const { key, value } of keyValues) {
            await updateUserInfo(key, value);
        }
        return "User info updated successfully. updated keys: " + keyValues.map(kv => kv.key).join(", ");
    },
});

const get_installed_apps = new DynamicTool({
    name: "get_installed_apps",
    description: "Get installed apps and path of the apps on user's device",
    func: async () => {
        return `
        Photoshop : C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe
        Blender : C:\\Program Files\\Blender Foundation\\Blender 3.2\\blender.exe
        `;
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
        `;
    },
});

const get_schedule = new DynamicTool({
    name: "get_schedule",
    description: "Get schedule of the user",
    func: async () => {
        return `
        Upcoming tasks:
        None
        `;
    },
});

const getCryptoPrice = new DynamicStructuredTool({
    name: "getCryptoPrice",
    description: "Get price of the cryptocurrency from CoinMarketCap.",
    schema: z.object({
        ticker: z.string().describe("Ticker of the cryptocurrency. Such as BTC, ETH, XRP, etc."),
    }),
    func: async ({ ticker }) => {
        const apiKey = await configRepository.getConfig("coinmarketcapApiKey");
        if (!apiKey || apiKey === "") {
            return "CoinMarketCap API key is not set. You need to explain user to set it in the config by himself.";
        }
        const response = await fetch(`https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${ticker}`, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey as string,
            },
        });
        const data = await response.json();
        return `
        ${ticker} : ${data.data[ticker].quote.USD.price}
        `;
    },
});

export const core_tools = [get_weather, get_installed_apps, open_app, openUrl, getBookmarks, get_schedule, getCryptoPrice];