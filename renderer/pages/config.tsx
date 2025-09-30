import { useEffect, useState } from "react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Toast } from "../components/Toast";
import { SecretInput } from "renderer/components/SecretInput";
import { ConfigResponse, LLMProvider, RecommendedModelsType } from "@shared/types";

// Recommended models by provider (client-side constant)
const RECOMMENDED_MODELS: RecommendedModelsType = {
    'openai': ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4o', 'gpt-4o-mini'],
    'anthropic': ['claude-sonnet-4-5-20250929', 'claude-sonnet-4-20250514', 'claude-opus-4-20250514'],
    'openrouter': ['anthropic/claude-sonnet-4.5', 'openai/gpt-5', 'meta-llama/llama-3.3-70b-instruct'],
    'azure-openai': ['gpt-5', 'gpt-4o', 'gpt-4o-mini'],
    'aws-bedrock': ['anthropic.claude-sonnet-4-v1', 'anthropic.claude-opus-4-v1', 'meta.llama3-70b-instruct-v1'],
    'google-vertex': ['gemini-2.0-pro', 'gemini-2.0-flash', 'claude-sonnet-4@anthropic'],
    'custom': []
};

export default function Config() {
    const [isLoading, setIsLoading] = useState(true);
    const [llmProvider, setLlmProvider] = useState<LLMProvider>('openai');
    const [modelName, setModelName] = useState<string>('gpt-5');
    const [customModelInput, setCustomModelInput] = useState<string>('');
    const [useCustomModel, setUseCustomModel] = useState(false);

    // API Keys
    const [openaiApiKey, setOpenaiApiKey] = useState('');
    const [anthropicApiKey, setAnthropicApiKey] = useState('');
    const [customApiKey, setCustomApiKey] = useState('');

    // Advanced settings
    const [customBaseURL, setCustomBaseURL] = useState('');
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [temperature, setTemperature] = useState(1);
    const [toastMessage, setToastMessage] = useState('');
    const [openweathermapApiKey, setOpenweathermapApiKey] = useState('');
    const [coinmarketcapApiKey, setCoinmarketcapApiKey] = useState('');
    const [chatHistoryLimit, setChatHistoryLimit] = useState(100);

    // Legacy support - map old llmService to new provider
    const [llmService, setLlmService] = useState<'openai' | 'anthropic'>('openai');

    const saveConfig = () => {
        const finalModelName = useCustomModel ? customModelInput : modelName;

        window.ipc.send('save_config', {
            // Legacy fields for backward compatibility
            openaiApiKey,
            anthropicApiKey,
            llmService: llmProvider === 'openai' || llmProvider === 'anthropic' ? llmProvider : llmService,
            selectedModel: finalModelName,
            temperature,
            openweathermapApiKey,
            coinmarketcapApiKey,
            chatHistoryLimit,
            // New flexible fields
            llmProvider,
            customBaseURL: showAdvanced ? customBaseURL : undefined,
            customApiKey: customApiKey || undefined,
        });
        setToastMessage('Config saved!');
    }

    const updateConfig = (response: ConfigResponse) => {
        console.log(response);
        setOpenaiApiKey(response.openaiApiKey);
        setAnthropicApiKey(response.anthropicApiKey);
        setLlmService(response.llmService);

        // Use new provider if available, fallback to legacy llmService
        const provider = response.llmProvider || response.llmService;
        setLlmProvider(provider);

        setModelName(response.selectedModel);
        setTemperature(response.temperature);
        setOpenweathermapApiKey(response.openweathermapApiKey);
        setCoinmarketcapApiKey(response.coinmarketcapApiKey);
        setChatHistoryLimit(response.chatHistoryLimit);

        if (response.customBaseURL) {
            setCustomBaseURL(response.customBaseURL);
            setShowAdvanced(true);
        }
        if (response.customApiKey) {
            setCustomApiKey(response.customApiKey);
        }

        setIsLoading(false);
    }

    const updateProvider = (provider: LLMProvider) => {
        setLlmProvider(provider);
        // Auto-select first recommended model for the provider
        const recommendedModels = RECOMMENDED_MODELS[provider];
        if (recommendedModels.length > 0) {
            setModelName(recommendedModels[0]);
            setUseCustomModel(false);
        }
    }

    const updateTemperature = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTemperature(Number(e.target.value));
    }

    const getApiKeyForProvider = (): string => {
        switch (llmProvider) {
            case 'openai':
            case 'azure-openai':
                return openaiApiKey;
            case 'anthropic':
                return anthropicApiKey;
            case 'openrouter':
            case 'aws-bedrock':
            case 'google-vertex':
            case 'custom':
                return customApiKey;
            default:
                return '';
        }
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

    const recommendedModels = RECOMMENDED_MODELS[llmProvider];
    const effectiveModelName = useCustomModel ? customModelInput : modelName;

    return (
        <div className="config-page bg-gray-800 text-white p-4 h-screen w-screen overflow-y-auto">
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}
            <h1 className="text-3xl font-bold mb-4">Config</h1>

            {/* LLM Provider Selection */}
            <label className="flex flex-col gap-2 py-4">
                <span className="text-2xl">LLM Provider</span>
                <select
                    className="bg-gray-700 text-white px-4 py-2 rounded-md"
                    value={llmProvider}
                    onChange={(e) => updateProvider(e.target.value as LLMProvider)}
                >
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="azure-openai">Azure OpenAI</option>
                    <option value="aws-bedrock">AWS Bedrock</option>
                    <option value="google-vertex">Google Vertex AI</option>
                    <option value="custom">Custom Endpoint</option>
                </select>
            </label>

            {/* Model Selection */}
            <label className="flex flex-col gap-2 py-4">
                <span className="text-2xl">Model</span>

                {/* Recommended models dropdown */}
                {!useCustomModel && recommendedModels.length > 0 && (
                    <select
                        className="bg-gray-700 text-white px-4 py-2 rounded-md"
                        value={modelName}
                        onChange={(e) => setModelName(e.target.value)}
                    >
                        {recommendedModels.map((model) => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                    </select>
                )}

                {/* Custom model input */}
                {useCustomModel && (
                    <input
                        type="text"
                        className="bg-gray-700 text-white px-4 py-2 rounded-md"
                        placeholder="Enter custom model name..."
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                    />
                )}

                {/* Toggle between dropdown and custom input */}
                {recommendedModels.length > 0 && (
                    <button
                        className="text-blue-400 hover:text-blue-300 text-sm text-left"
                        onClick={() => {
                            setUseCustomModel(!useCustomModel);
                            if (!useCustomModel) {
                                setCustomModelInput(modelName);
                            }
                        }}
                    >
                        {useCustomModel ? '← Use recommended models' : '→ Enter custom model name'}
                    </button>
                )}

                {recommendedModels.length === 0 && (
                    <input
                        type="text"
                        className="bg-gray-700 text-white px-4 py-2 rounded-md"
                        placeholder="Enter model name..."
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                    />
                )}

                <span className="text-sm text-gray-400">Current: {effectiveModelName}</span>
            </label>

            {/* Temperature */}
            <label className="flex flex-col gap-2 py-4">
                <div className="flex flex-row gap-2">
                    <span className="text-2xl">Temperature</span>
                    <span className="text-2xl">{temperature}</span>
                </div>
                <input
                    type="range"
                    value={temperature.toString()}
                    min="0"
                    max="1"
                    step="0.1"
                    onChange={updateTemperature}
                    className="bg-gray-700 px-4 py-2 rounded-md"
                />
            </label>

            {/* API Keys based on provider */}
            {(llmProvider === 'openai' || llmProvider === 'azure-openai') && (
                <label className="flex flex-col gap-2 py-2">
                    <span className="text-2xl">OpenAI API Key</span>
                    <SecretInput value={openaiApiKey} onChange={(value) => setOpenaiApiKey(value)} />
                </label>
            )}

            {llmProvider === 'anthropic' && (
                <label className="flex flex-col gap-2 py-2">
                    <span className="text-2xl">Anthropic API Key</span>
                    <SecretInput value={anthropicApiKey} onChange={(value) => setAnthropicApiKey(value)} />
                </label>
            )}

            {(llmProvider === 'openrouter' || llmProvider === 'aws-bedrock' || llmProvider === 'google-vertex' || llmProvider === 'custom') && (
                <label className="flex flex-col gap-2 py-2">
                    <span className="text-2xl">{llmProvider === 'openrouter' ? 'OpenRouter' : 'Custom'} API Key</span>
                    <SecretInput value={customApiKey} onChange={(value) => setCustomApiKey(value)} />
                </label>
            )}

            {/* Advanced Settings */}
            <div className="py-4">
                <button
                    className="text-blue-400 hover:text-blue-300 text-lg"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    {showAdvanced ? '▼' : '▶'} Advanced Settings
                </button>

                {showAdvanced && (
                    <div className="mt-4 space-y-4 pl-4 border-l-2 border-gray-600">
                        <label className="flex flex-col gap-2">
                            <span className="text-xl">Custom Base URL</span>
                            <input
                                type="text"
                                className="bg-gray-700 text-white px-4 py-2 rounded-md"
                                placeholder="https://api.example.com/v1"
                                value={customBaseURL}
                                onChange={(e) => setCustomBaseURL(e.target.value)}
                            />
                            <span className="text-sm text-gray-400">
                                For custom endpoints, proxies, or local LLMs (e.g., LM Studio, Ollama)
                            </span>
                        </label>
                    </div>
                )}
            </div>

            {/* Other API Keys */}
            <label className="flex flex-col gap-2 py-2">
                <span className="text-2xl">OpenWeatherMap API Key</span>
                <SecretInput value={openweathermapApiKey} onChange={(value) => setOpenweathermapApiKey(value)} />
            </label>

            <label className="flex flex-col gap-2 py-2">
                <span className="text-2xl">CoinMarketCap API Key</span>
                <SecretInput value={coinmarketcapApiKey} onChange={(value) => setCoinmarketcapApiKey(value)} />
            </label>

            {/* Chat History Limit */}
            <label className="flex flex-col gap-2 py-2">
                <span className="text-2xl">Save chat history up to</span>
                <input
                    type="number"
                    value={chatHistoryLimit}
                    onChange={(e) => setChatHistoryLimit(Number(e.target.value))}
                    className="bg-gray-700 text-white px-4 py-2 rounded-md"
                    style={{width: '100px'}}
                />
            </label>

            {/* Action Buttons */}
            <div className="flex gap-2 py-4">
                <button
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                    style={{ flex: 1 }}
                    onClick={saveConfig}
                >
                    Save
                </button>
                <button
                    className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
                    style={{ flex: 1 }}
                    onClick={() => window.ipc.send('user-action', 'CLOSE_CONFIG')}
                >
                    Close
                </button>
            </div>

            {/* Reset Chat History */}
            <label className="flex flex-col gap-2 py-2">
                <button
                    className="text-white px-4 py-2 rounded-md w-full hover:opacity-80"
                    style={{background:'rgba(215, 0, 0, 1)'}}
                    onClick={() => window.ipc.send('user-action', 'RESET_CHAT_HISTORY')}
                >
                    Reset chat history
                </button>
            </label>
        </div>
    )
}