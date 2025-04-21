import { useEffect, useState } from "react";

interface ConfigResponse {
    openaiApiKey: string;
    anthropicApiKey: string;
    llmService: llmService;
    selectedModel: string;
    temperature: number;
}

type llmService = 'openai' | 'anthropic' | ""

export default function Config() {
    const serviceModelMap = {
        openai: {
            models: ['gpt-4o-mini', 'gpt-4o', 'gpt-3.5-turbo'],
        },
        anthropic: {
            models: ['claude-3-5-sonnet-20240620', 'claude-3-haiku-20240307', 'claude-3-7-sonnet-20250219'],
        },
    }
    const [selectedModel, setSelectedModel] = useState<string | null>(null);
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [anthropicApiKey, setAnthropicApiKey] = useState('');
    const [llmService, setLlmService] = useState<llmService | null>(null);
    const [temperature, setTemperature] = useState(1);
    const saveConfig = () => {
        window.ipc.send('save_config', { openaiApiKey, anthropicApiKey, llmService, selectedModel, temperature });
    }

    const updateConfig = (response: ConfigResponse) => {
        console.log(response);
        setOpenaiApiKey(response.openaiApiKey);
        setAnthropicApiKey(response.anthropicApiKey);
        setLlmService(response.llmService);
        setSelectedModel(response.selectedModel);
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
        window.ipc.send('user-action', 'REQUEST_CONFIG');
        window.ipc.on('config_response', (response: ConfigResponse) => {
            updateConfig(response);
        });
    }, []);
    
    return (
        <div className="config-page bg-gray-800 text-white p-4 h-screen w-screen">
            <h1 className="text-2xl font-bold">Config</h1>
            <label className="flex flex-col gap-2">
                <span className="text-sm">LLM model</span>
                <select className="bg-gray-700 text-black px-4 py-2 rounded-md" defaultValue={llmService || ''} onChange={(e) => updateLlmService(e.target.value as llmService)}>
                    {Object.keys(serviceModelMap).map((service) => (
                        <option value={service} selected={llmService === service}>{service}</option>
                    ))}
                </select>
                <select className="bg-gray-700 text-black px-4 py-2 rounded-md" onChange={(e) => setSelectedModel(e.target.value)}>
                    {llmService && serviceModelMap[llmService].models.map((model) => (
                        <option value={model} selected={selectedModel === model}>{model}</option>
                    ))}
                </select>
            </label>
            <label>
                <span>temperature</span>
                <input type="range" value={temperature} min={0} max={1} step={0.1} onChange={updateTemperature} className="bg-gray-700 text-black px-4 py-2 rounded-md" />
            </label>
            <label className="flex flex-col gap-2">
                <span className="text-sm">OpenAI API Key</span>
                <input type="text" value={openaiApiKey} onChange={(e) => setOpenaiApiKey(e.target.value)} className="bg-gray-700 text-black px-4 py-2 rounded-md" />
            </label>
            <label className="flex flex-col gap-2">
                <span className="text-sm">Anthropic API Key</span>
                <input type="text" value={anthropicApiKey} onChange={(e) => setAnthropicApiKey(e.target.value)} className="bg-gray-700 text-black px-4 py-2 rounded-md" />
            </label>
            <div className="flex gap-2 py-2">
                <button className="bg-blue-500 text-white px-4 py-2 rounded-md" onClick={saveConfig}>Save</button>
                <button className="bg-red-500 text-white px-4 py-2 rounded-md" onClick={() => window.ipc.send('user-action', 'CLOSE_CONFIG')}>Close</button>
            </div>
        </div>
    )
}
