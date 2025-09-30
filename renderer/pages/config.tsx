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

type TabType = 'llm' | 'chat' | 'tools' | 'display' | 'developers';

export default function Config() {
    const [activeTab, setActiveTab] = useState<TabType>('llm');
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
    const [displayScale, setDisplayScale] = useState(0.5);
    const [speechBubbleWidth, setSpeechBubbleWidth] = useState(500);
    const [enableLightweightModel, setEnableLightweightModel] = useState(true);
    const [enableAutoSummarization, setEnableAutoSummarization] = useState(true);
    const [summarizationThreshold, setSummarizationThreshold] = useState(40);

    // Developer settings
    const [langsmithApiKey, setLangsmithApiKey] = useState('');
    const [enableLangsmithTracing, setEnableLangsmithTracing] = useState(false);
    const [langsmithProjectName, setLangsmithProjectName] = useState('akagaku');

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
            // Display settings
            displayScale,
            speechBubbleWidth,
            // Performance optimization
            enableLightweightModel,
            enableAutoSummarization,
            summarizationThreshold,
            // Developer settings
            langsmithApiKey,
            enableLangsmithTracing,
            langsmithProjectName,
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

        setDisplayScale(response.displayScale || 0.5);
        setSpeechBubbleWidth(response.speechBubbleWidth || 500);
        setEnableLightweightModel(response.enableLightweightModel !== false); // default true
        setEnableAutoSummarization(response.enableAutoSummarization !== false); // default true
        setSummarizationThreshold(response.summarizationThreshold || 40); // default 40

        // Developer settings
        setLangsmithApiKey(response.langsmithApiKey || '');
        setEnableLangsmithTracing(response.enableLangsmithTracing || false);
        setLangsmithProjectName(response.langsmithProjectName || 'akagaku');

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

    const recommendedModels = RECOMMENDED_MODELS[llmProvider] || [];
    const effectiveModelName = useCustomModel ? customModelInput : modelName;

    const TabButton = ({ tab, label }: { tab: TabType, label: string }) => (
        <button
            className={`px-4 py-2 text-lg font-medium ${
                activeTab === tab
                    ? 'bg-gray-700 text-white border-l-4 border-blue-500'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-750 hover:text-white'
            }`}
            onClick={() => setActiveTab(tab)}
        >
            {label}
        </button>
    );

    const renderLLMTab = () => (
        <div className="space-y-4">
            {/* LLM Provider Selection */}
            <label className="flex flex-col gap-2">
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
            <label className="flex flex-col gap-2">
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
            <label className="flex flex-col gap-2">
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
                <label className="flex flex-col gap-2">
                    <span className="text-2xl">OpenAI API Key</span>
                    <SecretInput value={openaiApiKey} onChange={(value) => setOpenaiApiKey(value)} />
                </label>
            )}

            {llmProvider === 'anthropic' && (
                <label className="flex flex-col gap-2">
                    <span className="text-2xl">Anthropic API Key</span>
                    <SecretInput value={anthropicApiKey} onChange={(value) => setAnthropicApiKey(value)} />
                </label>
            )}

            {(llmProvider === 'openrouter' || llmProvider === 'aws-bedrock' || llmProvider === 'google-vertex' || llmProvider === 'custom') && (
                <label className="flex flex-col gap-2">
                    <span className="text-2xl">{llmProvider === 'openrouter' ? 'OpenRouter' : 'Custom'} API Key</span>
                    <SecretInput value={customApiKey} onChange={(value) => setCustomApiKey(value)} />
                </label>
            )}

            {/* Advanced Settings */}
            <div className="py-2">
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
        </div>
    );

    const renderChatTab = () => (
        <div className="space-y-4">
            {/* Chat History Limit */}
            <label className="flex flex-col gap-2">
                <span className="text-2xl">Chat History Limit</span>
                <input
                    type="number"
                    value={chatHistoryLimit}
                    onChange={(e) => setChatHistoryLimit(Number(e.target.value))}
                    className="bg-gray-700 text-white px-4 py-2 rounded-md"
                    style={{width: '150px'}}
                />
                <span className="text-sm text-gray-400">
                    Maximum number of messages to keep in chat history
                </span>
            </label>

            {/* Performance Optimization Section */}
            <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-xl font-semibold mb-3">Performance Optimization</h3>

                {/* Auto Summarization */}
                <label className="flex items-center gap-3 py-2">
                    <input
                        type="checkbox"
                        checked={enableAutoSummarization}
                        onChange={(e) => setEnableAutoSummarization(e.target.checked)}
                        className="w-5 h-5"
                    />
                    <div className="flex flex-col flex-1">
                        <span className="text-lg">Auto Summarization</span>
                        <span className="text-sm text-gray-400">
                            Automatically summarize long conversations to reduce token usage
                        </span>
                    </div>
                </label>

                {/* Summarization Threshold */}
                {enableAutoSummarization && (
                    <label className="flex flex-col gap-2 pl-8">
                        <span className="text-md">Summarization Threshold</span>
                        <input
                            type="number"
                            value={summarizationThreshold}
                            onChange={(e) => setSummarizationThreshold(Number(e.target.value))}
                            className="bg-gray-700 text-white px-4 py-2 rounded-md"
                            style={{width: '150px'}}
                            min="20"
                            max="100"
                        />
                        <span className="text-sm text-gray-400">
                            Summarize when message count exceeds this number (default: 40)
                        </span>
                    </label>
                )}

                {/* Lightweight Model */}
                <label className="flex items-center gap-3 py-2">
                    <input
                        type="checkbox"
                        checked={enableLightweightModel}
                        onChange={(e) => setEnableLightweightModel(e.target.checked)}
                        className="w-5 h-5"
                    />
                    <div className="flex flex-col">
                        <span className="text-lg">Use Lightweight Models</span>
                        <span className="text-sm text-gray-400">
                            Use faster, cheaper models (gpt-4o-mini, claude-haiku) for tool calls and summarization
                        </span>
                    </div>
                </label>
            </div>

            {/* Reset Chat History */}
            <div className="border-t border-gray-700 pt-4 mt-4">
                <button
                    className="text-white px-4 py-2 rounded-md w-full hover:opacity-80"
                    style={{background:'rgba(215, 0, 0, 1)'}}
                    onClick={() => window.ipc.send('user-action', 'RESET_CHAT_HISTORY')}
                >
                    Reset Chat History
                </button>
                <span className="text-sm text-gray-400 block mt-2">
                    Warning: This will permanently delete all conversation history
                </span>
            </div>
        </div>
    );

    const renderToolsTab = () => (
        <div className="space-y-4">
            {/* OpenWeatherMap API Key */}
            <label className="flex flex-col gap-2">
                <span className="text-2xl">OpenWeatherMap API Key</span>
                <SecretInput value={openweathermapApiKey} onChange={(value) => setOpenweathermapApiKey(value)} />
                <span className="text-sm text-gray-400">
                    Required for weather-related features
                </span>
            </label>

            {/* CoinMarketCap API Key */}
            <label className="flex flex-col gap-2">
                <span className="text-2xl">CoinMarketCap API Key</span>
                <SecretInput value={coinmarketcapApiKey} onChange={(value) => setCoinmarketcapApiKey(value)} />
                <span className="text-sm text-gray-400">
                    Required for cryptocurrency price information
                </span>
            </label>
        </div>
    );

    const renderDisplayTab = () => (
        <div className="space-y-4">
            {/* Display Scale */}
            <label className="flex flex-col gap-2">
                <div className="flex flex-row gap-2">
                    <span className="text-2xl">Display Scale</span>
                    <span className="text-2xl">{(displayScale * 100).toFixed(0)}%</span>
                </div>
                <input
                    type="range"
                    value={displayScale}
                    min="0.25"
                    max="2.0"
                    step="0.05"
                    onChange={(e) => setDisplayScale(Number(e.target.value))}
                    className="bg-gray-700 px-4 py-2 rounded-md"
                />
                <span className="text-sm text-gray-400">
                    Adjust app zoom level. macOS Retina: 50%, Windows/Linux: 100%. Requires restart.
                </span>
            </label>

            {/* Speech Bubble Width */}
            <label className="flex flex-col gap-2">
                <span className="text-2xl">Speech Bubble Width</span>
                <input
                    type="number"
                    value={speechBubbleWidth}
                    onChange={(e) => setSpeechBubbleWidth(Number(e.target.value))}
                    className="bg-gray-700 text-white px-4 py-2 rounded-md"
                    style={{width: '150px'}}
                />
                <span className="text-sm text-gray-400">
                    Width in pixels. Default: 500. Requires restart.
                </span>
            </label>
        </div>
    );

    const renderDevelopersTab = () => (
        <div className="space-y-4">
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 text-sm">
                    ⚠️ Developer settings for debugging and performance monitoring. LangSmith tracing helps identify slow response times.
                </p>
            </div>

            {/* LangSmith Tracing */}
            <label className="flex items-center gap-3 py-2">
                <input
                    type="checkbox"
                    checked={enableLangsmithTracing}
                    onChange={(e) => setEnableLangsmithTracing(e.target.checked)}
                    className="w-5 h-5"
                />
                <div className="flex flex-col flex-1">
                    <span className="text-lg">Enable LangSmith Tracing</span>
                    <span className="text-sm text-gray-400">
                        Track LLM calls, latency, and token usage. Requires LangSmith API key.
                    </span>
                </div>
            </label>

            {/* LangSmith API Key */}
            {enableLangsmithTracing && (
                <>
                    <label className="flex flex-col gap-2">
                        <span className="text-2xl">LangSmith API Key</span>
                        <SecretInput
                            value={langsmithApiKey}
                            onChange={(value) => setLangsmithApiKey(value)}
                        />
                        <span className="text-sm text-gray-400">
                            Get your API key from <a href="https://smith.langchain.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">smith.langchain.com</a>
                        </span>
                    </label>

                    {/* LangSmith Project Name */}
                    <label className="flex flex-col gap-2">
                        <span className="text-2xl">Project Name</span>
                        <input
                            type="text"
                            value={langsmithProjectName}
                            onChange={(e) => setLangsmithProjectName(e.target.value)}
                            className="bg-gray-700 text-white px-4 py-2 rounded-md"
                            placeholder="akagaku"
                        />
                        <span className="text-sm text-gray-400">
                            LangSmith project for organizing traces. Default: "akagaku"
                        </span>
                    </label>
                </>
            )}

            {/* Performance Monitoring Info */}
            <div className="bg-gray-700/50 rounded-lg p-4 mt-6">
                <h3 className="text-lg font-semibold mb-2">Performance Debugging Tips</h3>
                <ul className="text-sm text-gray-300 space-y-2 list-disc list-inside">
                    <li>Enable LangSmith to see detailed timing for each LLM call and tool execution</li>
                    <li>Check console logs for [Performance] markers showing execution times</li>
                    <li>Long response times often caused by: tool execution, summarization, or slow LLM API</li>
                    <li>Adjust summarization threshold in Chat tab if summarization is slow</li>
                </ul>
            </div>
        </div>
    );

    return (
        <div className="config-page bg-gray-800 text-white h-screen w-screen flex">
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

            {/* Left Sidebar */}
            <div className="w-48 bg-gray-900 flex flex-col border-r border-gray-700">
                <div className="p-4 border-b border-gray-700">
                    <h1 className="text-2xl font-bold">Settings</h1>
                </div>
                <div className="flex-1 flex flex-col">
                    <TabButton tab="llm" label="LLM" />
                    <TabButton tab="chat" label="Chat" />
                    <TabButton tab="tools" label="Tools" />
                    <TabButton tab="display" label="Display" />
                    <TabButton tab="developers" label="Developers" />
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col">
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'llm' && renderLLMTab()}
                    {activeTab === 'chat' && renderChatTab()}
                    {activeTab === 'tools' && renderToolsTab()}
                    {activeTab === 'display' && renderDisplayTab()}
                    {activeTab === 'developers' && renderDevelopersTab()}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 p-4 border-t border-gray-700">
                    <button
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
                        style={{ flex: 1 }}
                        onClick={saveConfig}
                    >
                        Save
                    </button>
                    <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
                        style={{ flex: 1 }}
                        onClick={() => window.ipc.send('user-action', 'CLOSE_CONFIG')}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    )
}