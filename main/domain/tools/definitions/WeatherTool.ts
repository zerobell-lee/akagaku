import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { ToolMetadata, ToolConfig } from "../../entities/Tool";

export const WeatherToolMetadata: ToolMetadata = {
  id: 'get_weather',
  name: 'Weather Information',
  description: 'Get current weather for any location',
  category: 'weather',
  configFields: [
    {
      key: 'apiKey',
      label: 'OpenWeatherMap API Key',
      type: 'api_key',
      required: true,
      description: 'Get your API key from openweathermap.org',
      placeholder: 'Enter your API key'
    }
  ]
};

export const createWeatherTool = (config: ToolConfig): DynamicStructuredTool => {
  return new DynamicStructuredTool({
    name: "get_weather",
    description: "return current weather of given location. It takes so long time to get the weather of user's location. So, use this tool only when user asked you about weather.",
    schema: z.object({
      location: z.string(),
    }),
    func: async ({ location }) => {
      const apiKey = config.settings.apiKey;
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
};
