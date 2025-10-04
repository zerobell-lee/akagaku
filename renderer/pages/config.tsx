import { useEffect, useState, useRef } from "react";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { Toast } from "../components/Toast";
import { SecretInput } from "renderer/components/SecretInput";
import { ToolConfigEditor } from "renderer/components/ToolConfigEditor";
import { ConfigResponse, LLMProvider, RecommendedModelsType, ToolConfig } from "@shared/types";

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
    const [keepRecentMessages, setKeepRecentMessages] = useState(20);
    const [hoveredDivider, setHoveredDivider] = useState<string | null>(null);

    // Developer settings
    const [langsmithApiKey, setLangsmithApiKey] = useState('');
    const [enableLangsmithTracing, setEnableLangsmithTracing] = useState(false);

    // Speech bubble styling
    const [speechBubbleFontFamily, setSpeechBubbleFontFamily] = useState('');
    const [speechBubbleFontSize, setSpeechBubbleFontSize] = useState(24);
    const [speechBubbleCustomCSS, setSpeechBubbleCustomCSS] = useState('');
    const [systemFonts, setSystemFonts] = useState<string[]>([]);
    const [fontSearchQuery, setFontSearchQuery] = useState('');
    const [showFontDropdown, setShowFontDropdown] = useState(false);
    const fontDropdownRef = useRef<HTMLDivElement>(null);
    const [langsmithProjectName, setLangsmithProjectName] = useState('akagaku');

    // Legacy support - map old llmService to new provider
    const [llmService, setLlmService] = useState<'openai' | 'anthropic'>('openai');

    // Tool configurations
    const [toolConfigs, setToolConfigs] = useState<Record<string, ToolConfig>>({});
    const [availableTools, setAvailableTools] = useState<any[]>([]);

    const saveConfig = () => {
        const finalModelName = useCustomModel ? customModelInput : modelName;

        window.ipc.send('save_config', {
            // Legacy fields for backward compatibility
            openaiApiKey,
            anthropicApiKey,
            llmService: llmProvider, // Always use llmProvider value
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
            keepRecentMessages,
            // Developer settings
            langsmithApiKey,
            enableLangsmithTracing,
            langsmithProjectName,
            // Speech bubble styling
            speechBubbleFontFamily,
            speechBubbleFontSize,
            speechBubbleCustomCSS,
            // Tool configurations
            toolConfigs,
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
        setChatHistoryLimit(response.chatHistoryLimit || 100); // default 100

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
        setKeepRecentMessages(response.keepRecentMessages || 20); // default 20

        // Developer settings
        setLangsmithApiKey(response.langsmithApiKey || '');
        setEnableLangsmithTracing(response.enableLangsmithTracing || false);
        setLangsmithProjectName(response.langsmithProjectName || 'akagaku');

        // Speech bubble styling
        setSpeechBubbleFontFamily(response.speechBubbleFontFamily || '');
        setFontSearchQuery(response.speechBubbleFontFamily || '');
        setSpeechBubbleFontSize(response.speechBubbleFontSize || 24);
        setSpeechBubbleCustomCSS(response.speechBubbleCustomCSS || '');

        // Tool configurations
        setToolConfigs(response.toolConfigs || {});

        setIsLoading(false);
    }

    // Close font dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target as Node)) {
                setShowFontDropdown(false);
            }
        };

        if (showFontDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showFontDropdown]);

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

        // Load system fonts
        window.ipc.invoke('get-system-fonts').then((fonts: string[]) => {
            setSystemFonts(fonts);
        });

        // Load available tools
        window.ipc.invoke('get-available-tools').then((tools: any[]) => {
            setAvailableTools(tools);
        });
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
                <span className="text-3xl">LLM Provider</span>
                <select
                    className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
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
                <span className="text-3xl">Model</span>

                {/* Recommended models dropdown */}
                {!useCustomModel && recommendedModels.length > 0 && (
                    <select
                        className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
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
                        className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
                        placeholder="Enter custom model name..."
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                    />
                )}

                {/* Toggle between dropdown and custom input */}
                {recommendedModels.length > 0 && (
                    <button
                        className="text-blue-400 hover:text-blue-300 text-xl text-left"
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
                        className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
                        placeholder="Enter model name..."
                        value={customModelInput}
                        onChange={(e) => setCustomModelInput(e.target.value)}
                    />
                )}

                <span className="text-xl text-gray-400">Current: {effectiveModelName}</span>
            </label>

            {/* Temperature */}
            <label className="flex flex-col gap-2">
                <div className="flex flex-row gap-2">
                    <span className="text-3xl">Temperature</span>
                    <span className="text-3xl">{temperature}</span>
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
                    <span className="text-3xl">OpenAI API Key</span>
                    <SecretInput value={openaiApiKey} onChange={(value) => setOpenaiApiKey(value)} />
                </label>
            )}

            {llmProvider === 'anthropic' && (
                <label className="flex flex-col gap-2">
                    <span className="text-3xl">Anthropic API Key</span>
                    <SecretInput value={anthropicApiKey} onChange={(value) => setAnthropicApiKey(value)} />
                </label>
            )}

            {(llmProvider === 'openrouter' || llmProvider === 'aws-bedrock' || llmProvider === 'google-vertex' || llmProvider === 'custom') && (
                <label className="flex flex-col gap-2">
                    <span className="text-3xl">{llmProvider === 'openrouter' ? 'OpenRouter' : 'Custom'} API Key</span>
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
                            <span className="text-3xl">Custom Base URL</span>
                            <input
                                type="text"
                                className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
                                placeholder="https://api.example.com/v1"
                                value={customBaseURL}
                                onChange={(e) => setCustomBaseURL(e.target.value)}
                            />
                            <span className="text-xl text-gray-400">
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

            {/* Performance Optimization Section */}
            <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-3xl font-semibold mb-3">Performance Optimization</h3>

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
                        <span className="text-xl text-gray-400">
                            Automatically summarize long conversations to reduce token usage
                        </span>
                    </div>
                </label>

                {/* Storage Limit - Always visible */}
                <div className="flex flex-col gap-2 pl-8 mt-4">
                    <label className="flex flex-col gap-2">
                        <span className="text-md">Storage Limit</span>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                value={chatHistoryLimit}
                                onChange={(e) => setChatHistoryLimit(Number(e.target.value))}
                                className="flex-1"
                                min="50"
                                max="200"
                                step="10"
                            />
                            <span className="text-white font-mono w-12 text-right">{chatHistoryLimit}</span>
                        </div>
                        <span className="text-xl text-gray-400">
                            Maximum number of messages to store in history (default: 100)
                        </span>
                    </label>
                </div>

                {/* Summarization Settings - Advanced */}
                {enableAutoSummarization && (
                    <div className="flex flex-col gap-4 pl-8 bg-gray-800 p-4 rounded-md mt-2">
                        <div className="text-lg text-gray-400 mb-2">
                            ⚙️ <span className="font-semibold">Advanced Settings</span> - Summarization configuration
                        </div>

                        {/* Interactive Drag Bar */}
                        <div className="bg-gray-900 p-6 rounded-md">
                            <div className="text-lg text-gray-300 mb-4 font-semibold">Interactive History Range Configuration</div>

                            {/* Scale markers */}
                            <div className="relative mb-2">
                                <div className="flex justify-between text-xs text-gray-500">
                                    <span>0</span>
                                    <span>50</span>
                                    <span>100</span>
                                    <span>150</span>
                                    <span>200</span>
                                </div>
                            </div>

                            {/* Draggable Bar Container */}
                            <div className="relative h-16 bg-black rounded-lg border-2 border-gray-600">
                                {/* Keep Recent (Green) - using inline style for guaranteed color */}
                                <div
                                    className="absolute left-0 top-0 h-full rounded-l-lg transition-all pointer-events-none"
                                    style={{
                                        width: `${(keepRecentMessages / 200) * 100}%`,
                                        backgroundColor: '#16a34a'  // green-600
                                    }}
                                />

                                {/* To Summarize (Yellow) */}
                                <div
                                    className="absolute top-0 h-full transition-all pointer-events-none"
                                    style={{
                                        left: `${(keepRecentMessages / 200) * 100}%`,
                                        width: `${((summarizationThreshold - keepRecentMessages) / 200) * 100}%`,
                                        backgroundColor: '#ca8a04'  // yellow-600
                                    }}
                                />

                                {/* Buffer Zone (Orange) */}
                                <div
                                    className="absolute top-0 h-full transition-all pointer-events-none"
                                    style={{
                                        left: `${(summarizationThreshold / 200) * 100}%`,
                                        width: `${((chatHistoryLimit - summarizationThreshold) / 200) * 100}%`,
                                        backgroundColor: '#ea580c'  // orange-600
                                    }}
                                />

                                {/* Unused Space (Dark Gray) */}
                                <div
                                    className="absolute top-0 h-full rounded-r-lg transition-all pointer-events-none"
                                    style={{
                                        left: `${(chatHistoryLimit / 200) * 100}%`,
                                        width: `${((200 - chatHistoryLimit) / 200) * 100}%`,
                                        backgroundColor: '#374151'  // gray-700
                                    }}
                                />

                                {/* Draggable Dividers */}
                                {/* Keep Recent Divider */}
                                <div
                                    className="absolute top-0 h-full w-1 bg-white cursor-ew-resize hover:bg-green-300 z-10 transition-colors"
                                    style={{left: `${(keepRecentMessages / 200) * 100}%`, marginLeft: '-2px'}}
                                    draggable
                                    onMouseEnter={() => setHoveredDivider('keep')}
                                    onMouseLeave={() => setHoveredDivider(null)}
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('divider', 'keep');
                                    }}
                                    onDrag={(e) => {
                                        if (e.clientX === 0) return;
                                        const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const value = Math.round((x / rect.width) * 200);
                                        if (value >= 10 && value < summarizationThreshold - 10) {
                                            setKeepRecentMessages(Math.min(50, value));
                                        }
                                    }}
                                >
                                    {/* Tooltip */}
                                    {hoveredDivider === 'keep' && (
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                                            Keep Recent: {keepRecentMessages}
                                        </div>
                                    )}
                                </div>

                                {/* Threshold Divider */}
                                <div
                                    className="absolute top-0 h-full w-1 bg-white cursor-ew-resize hover:bg-yellow-300 z-10 transition-colors"
                                    style={{left: `${(summarizationThreshold / 200) * 100}%`, marginLeft: '-2px'}}
                                    draggable
                                    onMouseEnter={() => setHoveredDivider('threshold')}
                                    onMouseLeave={() => setHoveredDivider(null)}
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('divider', 'threshold');
                                    }}
                                    onDrag={(e) => {
                                        if (e.clientX === 0) return;
                                        const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const value = Math.round((x / rect.width) * 200);
                                        if (value > keepRecentMessages + 10 && value < chatHistoryLimit - 10) {
                                            setSummarizationThreshold(Math.min(100, value));
                                        }
                                    }}
                                >
                                    {/* Tooltip */}
                                    {hoveredDivider === 'threshold' && (
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                                            Trigger: {summarizationThreshold}
                                        </div>
                                    )}
                                </div>

                                {/* Storage Limit Divider */}
                                <div
                                    className="absolute top-0 h-full w-1 bg-red-500 cursor-ew-resize hover:bg-red-300 z-10 transition-colors"
                                    style={{left: `${(chatHistoryLimit / 200) * 100}%`, marginLeft: '-2px'}}
                                    draggable
                                    onMouseEnter={() => setHoveredDivider('limit')}
                                    onMouseLeave={() => setHoveredDivider(null)}
                                    onDragStart={(e) => {
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('divider', 'limit');
                                    }}
                                    onDrag={(e) => {
                                        if (e.clientX === 0) return;
                                        const rect = e.currentTarget.parentElement!.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const value = Math.round((x / rect.width) * 200);
                                        if (value > summarizationThreshold + 10 && value <= 200) {
                                            setChatHistoryLimit(value);
                                        }
                                    }}
                                >
                                    {/* Tooltip */}
                                    {hoveredDivider === 'limit' && (
                                        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-20">
                                            Storage Limit: {chatHistoryLimit}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Value Display */}
                            <div className="flex justify-between mt-4 text-xs">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-green-600 rounded"></div>
                                    <span className="text-gray-300">Keep Recent: <span className="font-mono text-white">{keepRecentMessages}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                                    <span className="text-gray-300">Trigger: <span className="font-mono text-white">{summarizationThreshold}</span></span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                                    <span className="text-gray-300">Storage Limit: <span className="font-mono text-white">{chatHistoryLimit}</span></span>
                                </div>
                            </div>

                            {/* Validation Messages */}
                            <div className="mt-4 space-y-1">
                                {summarizationThreshold >= chatHistoryLimit && (
                                    <div className="text-xs text-red-400">
                                        ⚠️ Trigger must be less than storage limit
                                    </div>
                                )}
                                {keepRecentMessages >= summarizationThreshold && (
                                    <div className="text-xs text-red-400">
                                        ⚠️ Keep recent must be less than trigger
                                    </div>
                                )}
                                {(summarizationThreshold - keepRecentMessages) < 10 && summarizationThreshold < chatHistoryLimit && keepRecentMessages < summarizationThreshold && (
                                    <div className="text-xs text-yellow-400">
                                        ⚠️ Too few messages to summarize ({summarizationThreshold - keepRecentMessages}). Minimum 10 recommended
                                    </div>
                                )}
                            </div>

                            {/* Help Text */}
                            <div className="mt-4 text-xs text-gray-400 space-y-1">
                                <p>• <strong>Drag the dividers</strong> to adjust values</p>
                                <p>• <strong>Green</strong>: Messages kept in original form</p>
                                <p>• <strong>Yellow</strong>: Messages to be summarized when trigger is reached</p>
                                <p>• <strong>Orange</strong>: Buffer zone before hitting storage limit</p>
                            </div>
                        </div>
                    </div>
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
                        <span className="text-xl text-gray-400">
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
                <span className="text-xl text-gray-400 block mt-2">
                    Warning: This will permanently delete all conversation history
                </span>
            </div>
        </div>
    );

    const renderToolsTab = () => {
        const groupedTools = availableTools.reduce((acc, tool) => {
            if (!acc[tool.category]) {
                acc[tool.category] = [];
            }
            acc[tool.category].push(tool);
            return acc;
        }, {} as Record<string, any[]>);

        return (
            <div className="space-y-4">
                <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                    <p className="text-xl text-gray-300">
                        Enable the tools you want to use. Each tool may require additional configuration.
                    </p>
                </div>

                {Object.entries(groupedTools).map(([category, tools]: [string, any[]]) => (
                    <div key={category} className="border-b border-gray-700 pb-4">
                        <h3 className="text-lg font-semibold mb-3 capitalize">{category} Tools</h3>

                        {tools.map(tool => {
                            const config = toolConfigs[tool.id] || { enabled: false, settings: {} };

                            return (
                                <div key={tool.id} className="mb-4">
                                    {/* Tool Enable Checkbox */}
                                    <label className="flex items-center gap-3 py-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.enabled}
                                            onChange={(e) => {
                                                setToolConfigs({
                                                    ...toolConfigs,
                                                    [tool.id]: {
                                                        enabled: e.target.checked,
                                                        settings: config.settings
                                                    }
                                                });
                                            }}
                                            className="w-5 h-5"
                                        />
                                        <div className="flex flex-col flex-1">
                                            <span className="text-lg">{tool.name}</span>
                                            <span className="text-xl text-gray-400">{tool.description}</span>
                                        </div>
                                    </label>

                                    {/* Tool Config Editor (shown when enabled and has config fields) */}
                                    {config.enabled && tool.configFields.length > 0 && (
                                        <ToolConfigEditor
                                            metadata={tool}
                                            config={config}
                                            onChange={(newConfig) => {
                                                setToolConfigs({
                                                    ...toolConfigs,
                                                    [tool.id]: newConfig
                                                });
                                            }}
                                        />
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    const renderDisplayTab = () => (
        <div className="space-y-4">
            {/* Display Scale */}
            <label className="flex flex-col gap-2">
                <div className="flex flex-row gap-2">
                    <span className="text-3xl">Display Scale</span>
                    <span className="text-3xl">{(displayScale * 100).toFixed(0)}%</span>
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
                <span className="text-xl text-gray-400">
                    Adjust app zoom level. macOS Retina: 50%, Windows/Linux: 100%. Requires restart.
                </span>
            </label>

            {/* Speech Bubble Width */}
            <label className="flex flex-col gap-2">
                <span className="text-3xl">Speech Bubble Width</span>
                <input
                    type="number"
                    value={speechBubbleWidth}
                    onChange={(e) => setSpeechBubbleWidth(Number(e.target.value))}
                    className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
                    style={{width: '150px'}}
                />
                <span className="text-xl text-gray-400">
                    Width in pixels. Default: 500. Requires restart.
                </span>
            </label>

            {/* Speech Bubble Styling Section */}
            <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="text-3xl font-semibold mb-3">Speech Bubble Styling</h3>

                {/* Font Family */}
                <label className="flex flex-col gap-2 mb-4">
                    <span className="text-lg">Font Family</span>
                    <div className="relative" ref={fontDropdownRef}>
                        <div
                            className="bg-gray-700 text-white px-4 py-2 rounded-md cursor-pointer flex justify-between items-center"
                            onClick={() => {
                                setFontSearchQuery('');
                                setShowFontDropdown(!showFontDropdown);
                            }}
                        >
                            <span>{speechBubbleFontFamily || 'Default (System Font)'}</span>
                            <span className="text-gray-400">{showFontDropdown ? '▲' : '▼'}</span>
                        </div>
                        {showFontDropdown && (
                            <div className="absolute z-10 w-full mt-1 bg-gray-700 rounded-md shadow-lg max-h-60 overflow-hidden flex flex-col">
                                <input
                                    type="text"
                                    className="bg-gray-600 text-white px-4 py-2 border-b border-gray-500 outline-none"
                                    placeholder="Search fonts..."
                                    value={fontSearchQuery}
                                    onChange={(e) => setFontSearchQuery(e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                />
                                <div className="overflow-y-auto max-h-52">
                                    <div
                                        className="px-4 py-2 hover:bg-gray-600 cursor-pointer text-white"
                                        onClick={() => {
                                            setSpeechBubbleFontFamily('');
                                            setFontSearchQuery('');
                                            setShowFontDropdown(false);
                                        }}
                                    >
                                        Default (System Font)
                                    </div>
                                    {systemFonts
                                        .filter(font => font.toLowerCase().includes(fontSearchQuery.toLowerCase()))
                                        .map((font) => (
                                            <div
                                                key={font}
                                                className="px-4 py-2 hover:bg-gray-600 cursor-pointer text-white"
                                                style={{ fontFamily: font }}
                                                onClick={() => {
                                                    setSpeechBubbleFontFamily(font);
                                                    setFontSearchQuery('');
                                                    setShowFontDropdown(false);
                                                }}
                                            >
                                                {font}
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <span className="text-xl text-gray-400">
                        Click to select, search to filter fonts
                    </span>
                    {/* Font Preview */}
                    <div
                        className="bg-gray-600 text-white px-4 py-3 rounded-md mt-2"
                        style={{
                            fontFamily: speechBubbleFontFamily || 'inherit',
                            fontSize: `${speechBubbleFontSize}px`
                        }}
                    >
                        안녕하세요! Hello! 가나다라마바사 ABCDEFG 1234567890
                    </div>
                </label>

                {/* Font Size */}
                <label className="flex flex-col gap-2 mb-4">
                    <span className="text-lg">Font Size</span>
                    <input
                        type="number"
                        value={speechBubbleFontSize}
                        onChange={(e) => setSpeechBubbleFontSize(Number(e.target.value) || 0)}
                        onBlur={(e) => {
                            if (e.target.value === '' || Number(e.target.value) === 0) {
                                setSpeechBubbleFontSize(24);
                            }
                        }}
                        className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
                        style={{width: '150px'}}
                        min="10"
                        max="32"
                    />
                    <span className="text-xl text-gray-400">
                        Font size in pixels. Default: 24
                    </span>
                </label>

                {/* Custom CSS */}
                <label className="flex flex-col gap-2">
                    <span className="text-lg">Custom CSS Override</span>
                    <textarea
                        value={speechBubbleCustomCSS}
                        onChange={(e) => setSpeechBubbleCustomCSS(e.target.value)}
                        className="bg-gray-700 text-white px-4 py-2 rounded-md font-mono text-lg"
                        rows={6}
                        placeholder="/* Custom CSS rules for speech bubble */
.speechBubble {
  color: #ffffff;
  text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
}"
                    />
                    <span className="text-xl text-gray-400">
                        Advanced: Add custom CSS rules to override speech bubble styling
                    </span>
                </label>
            </div>
        </div>
    );

    const renderDevelopersTab = () => (
        <div className="space-y-4">
            <div className="bg-yellow-900/30 border border-yellow-600/50 rounded-lg p-4 mb-4">
                <p className="text-yellow-200 text-xl">
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
                    <span className="text-xl text-gray-400">
                        Track LLM calls, latency, and token usage. Requires LangSmith API key.
                    </span>
                </div>
            </label>

            {/* LangSmith API Key */}
            {enableLangsmithTracing && (
                <>
                    <label className="flex flex-col gap-2">
                        <span className="text-3xl">LangSmith API Key</span>
                        <SecretInput
                            value={langsmithApiKey}
                            onChange={(value) => setLangsmithApiKey(value)}
                        />
                        <span className="text-xl text-gray-400">
                            Get your API key from <a href="https://smith.langchain.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">smith.langchain.com</a>
                        </span>
                    </label>

                    {/* LangSmith Project Name */}
                    <label className="flex flex-col gap-2">
                        <span className="text-3xl">Project Name</span>
                        <input
                            type="text"
                            value={langsmithProjectName}
                            onChange={(e) => setLangsmithProjectName(e.target.value)}
                            className="bg-gray-700 text-white px-4 py-2 rounded-md text-xl"
                            placeholder="akagaku"
                        />
                        <span className="text-xl text-gray-400">
                            LangSmith project for organizing traces. Default: "akagaku"
                        </span>
                    </label>
                </>
            )}

            {/* Performance Monitoring Info */}
            <div className="bg-gray-700/50 rounded-lg p-4 mt-6">
                <h3 className="text-lg font-semibold mb-2">Performance Debugging Tips</h3>
                <ul className="text-xl text-gray-300 space-y-2 list-disc list-inside">
                    <li>Enable LangSmith to see detailed timing for each LLM call and tool execution</li>
                    <li>Check console logs for [Performance] markers showing execution times</li>
                    <li>Long response times often caused by: tool execution, summarization, or slow LLM API</li>
                    <li>Adjust summarization threshold in Chat tab if summarization is slow</li>
                </ul>
            </div>

            {/* Dangerous Actions */}
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-4 mt-6">
                <h3 className="text-lg font-semibold mb-4 text-red-300">⚠️ Dangerous Actions</h3>

                {/* Reset Window State */}
                <div className="mb-4">
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to reset all window positions?\n\nThis will clear saved window positions and sizes for all windows.')) {
                                if (confirm('This action cannot be undone. Are you really sure?')) {
                                    window.ipc.send('reset-window-state');
                                    alert('Window state has been reset. The app will restart now.');
                                }
                            }
                        }}
                        className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-md text-xl transition-colors"
                    >
                        Reset Window State
                    </button>
                    <p className="text-xl text-gray-400 mt-2">
                        Clears all saved window positions and sizes. Useful when windows appear off-screen.
                    </p>
                </div>

                {/* Factory Reset */}
                <div>
                    <button
                        onClick={() => {
                            if (confirm('⚠️ FACTORY RESET ⚠️\n\nThis will:\n• Delete ALL settings\n• Clear ALL chat history\n• Remove ALL saved data\n• Reset to first-time setup\n\nAre you absolutely sure?')) {
                                if (confirm('FINAL WARNING: This action CANNOT be undone!\n\nAll your data will be permanently deleted.\n\nType "OK" to proceed.')) {
                                    window.ipc.send('factory-reset');
                                    alert('Factory reset complete. The app will restart now.');
                                }
                            }
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-xl transition-colors"
                    >
                        Factory Reset
                    </button>
                    <p className="text-xl text-gray-400 mt-2">
                        Completely resets the app to initial state. ALL data will be lost permanently.
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="config-page bg-gray-800 text-white h-screen w-screen flex">
            {toastMessage && <Toast message={toastMessage} onClose={() => setToastMessage('')} />}

            {/* Left Sidebar */}
            <div className="w-48 bg-gray-900 flex flex-col border-r border-gray-700">
                <div className="p-4 border-b border-gray-700">
                    <h1 className="text-3xl font-bold">Settings</h1>
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
                        className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 text-2xl"
                        style={{ flex: 1 }}
                        onClick={saveConfig}
                    >
                        Save
                    </button>
                    <button
                        className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 text-2xl"
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