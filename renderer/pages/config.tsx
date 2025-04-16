import { useEffect, useState } from "react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Toast } from "../components/Toast";
import { SecretInput } from "renderer/components/SecretInput";
import { ConfigResponse, llmService } from "@shared/types";

export default function Config() {
    const serviceModelMap = {
        openai: {
            models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        },
        anthropic: {
            models: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307', 'claude-3-7-sonnet-20250219'],
        },
    }
    const [isLoading, setIsLoading] = useState(true);
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [anthropicApiKey, setAnthropicApiKey] = useState('');
    const [llmService, setLlmService] = useState<llmService | null>(null);
    const [temperature, setTemperature] = useState(1);
    const [toastMessage, setToastMessage] = useState('');
    const [openweathermapApiKey, setOpenweathermapApiKey] = useState('');
    const [chatHistoryLimit, setChatHistoryLimit] = useState(100);
    const saveConfig = () => {
        window.ipc.send('save_config', { openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature, openweathermapApiKey, chatHistoryLimit });
        setToastMessage('Config saved!');
    }

    const updateConfig = (response: ConfigResponse) => {
        console.log(response);
        setOpenaiApiKey(response.openaiApiKey);
        setAnthropicApiKey(response.anthropicApiKey);
        setLlmService(response.llmService);
        setSelectedModel(response.selectedModel);
        setTemperature(response.temperature);
        setOpenweathermapApiKey(response.openweathermapApiKey);
        setChatHistoryLimit(response.chatHistoryLimit);
        setIsLoading(false);
    }

    const updateLlmService = (llmService: llmService) => {
        if (llmService === null) {
            return
        } else {
            setLlmService(llmService);
            setSelectedModel(serviceModelMap[llmService].models[0]);
        }
    }

    const updateTemperature = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTemperature(Number(e.target.value));
    }

    useEffect(() => {
        window.ipc.on('config_response', (response: ConfigResponse) => {
            updateConfig(response);
        });
        window.ipc.send('user-action', 'REQUEST_CONFIG');
    }, []);

    if (isLoading) {
        return <LoadingSpinner />
    }
    
    return (
        <div className="config-page bg-gray-800 text-white p-4 h-screen w-screen">
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}
            <h1 className="text-3xl font-bold">Config</h1>
            <label className="flex flex-col gap-2 py-4">
                <span className="text-2xl">LLM model</span>
                <select className="bg-gray-700 text-black px-4 py-2 rounded-md" defaultValue={llmService} onChange={(e) => updateLlmService(e.target.value as llmService)}>
                    {Object.keys(serviceModelMap).map((service) => (
                        <option value={service}>{service}</option>
                    ))}
                </select>
                <select className="bg-gray-700 text-black px-4 py-2 rounded-md" onChange={(e) => setSelectedModel(e.target.value)}>
                    {llmService && serviceModelMap[llmService].models.map((model) => (
                        <option value={model} selected={selectedModel === model}>{model}</option>
                    ))}
                </select>
            </label>
            <label className="flex flex-col gap-2 py-4">
                <div className="flex flex-row gap-2">
                    <span className="text-2xl">temperature</span>
                    <span className="text-2xl">{temperature}</span>
                </div>
                <input type="range" value={temperature.toString()} min="0" max="1" step="0.1" onChange={updateTemperature} className="bg-gray-700 text-black px-4 py-2 rounded-md" />
            </label>
            <label className="flex flex-col gap-2">
                <span className="text-2xl">OpenAI API Key</span>
                <SecretInput value={openaiApiKey} onChange={(value) => setOpenaiApiKey(value)} />
            </label>
            <label className="flex flex-col gap-2">
                <span className="text-2xl">Anthropic API Key</span>
                <SecretInput value={anthropicApiKey} onChange={(value) => setAnthropicApiKey(value)} />
            </label>
            <label className="flex flex-col gap-2">
                <span className="text-2xl">OpenWeatherMap API Key</span>
                <SecretInput value={openweathermapApiKey} onChange={(value) => setOpenweathermapApiKey(value)} />
            </label>
            <label className="flex flex-col gap-2">
                <span className="text-2xl">Save chat history up to</span>
                <input type="number" value={chatHistoryLimit} onChange={(e) => setChatHistoryLimit(Number(e.target.value))} className="bg-gray-700 text-black px-4 py-2 rounded-md" style={{width: '100px', color: 'black'}} />
            </label>
            <div className="flex gap-2 py-2">
                <button className="bg-blue-500  text-white px-4 py-2 rounded-md" style={{ flex: 1 }} onClick={saveConfig}>Save</button>
                <button className="bg-red-500 text-white px-4 py-2 rounded-md" style={{ flex: 1 }} onClick={() => window.ipc.send('user-action', 'CLOSE_CONFIG')}>Close</button>
            </div>
            <label className="flex flex-col gap-2">
                <button className="text-white px-4 py-2 rounded-md w-full" style={{background:'rgba(215, 0, 0, 1)'}} onClick={() => window.ipc.send('user-action', 'RESET_CHAT_HISTORY')}>Reset chat history</button>
            </label>
        </div>
    )
}
