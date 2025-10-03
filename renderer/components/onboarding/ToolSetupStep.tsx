import { SecretInput } from '../SecretInput';

interface ToolConfig {
    id: string;
    name: string;
    description: string;
    requiresApiKey: boolean;
    apiKeyPlaceholder?: string;
}

interface ApiKeyInfo {
    provider: string;
    signupUrl: string;
    instructions: string;
}

const AVAILABLE_TOOLS: ToolConfig[] = [
    {
        id: 'get_weather',
        name: 'Weather',
        description: 'Check current weather conditions',
        requiresApiKey: true,
        apiKeyPlaceholder: 'OpenWeatherMap API key'
    },
    {
        id: 'get_crypto_price',
        name: 'Cryptocurrency',
        description: 'Get cryptocurrency prices',
        requiresApiKey: true,
        apiKeyPlaceholder: 'CoinMarketCap API key'
    },
    {
        id: 'open_url',
        name: 'Browser',
        description: 'Open websites in browser',
        requiresApiKey: false
    },
    {
        id: 'open_app',
        name: 'Applications',
        description: 'Launch installed applications',
        requiresApiKey: false
    }
];

const API_KEY_INFO: Record<string, ApiKeyInfo> = {
    'get_weather': {
        provider: 'OpenWeatherMap',
        signupUrl: 'https://home.openweathermap.org/api_keys',
        instructions: 'Sign up for a free account and create an API key'
    },
    'get_crypto_price': {
        provider: 'CoinMarketCap',
        signupUrl: 'https://coinmarketcap.com/api/',
        instructions: 'Get a free API key from the Basic plan'
    }
};

interface ToolSetupStepProps {
    selectedTools: Set<string>;
    toolApiKeys: Record<string, string>;
    onToolToggle: (toolId: string) => void;
    onToolApiKeyChange: (toolId: string, apiKey: string) => void;
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
}

export function ToolSetupStep({
    selectedTools,
    toolApiKeys,
    onToolToggle,
    onToolApiKeyChange,
    onNext,
    onBack,
    onSkip
}: ToolSetupStepProps) {

    return (
        <div className="flex flex-col px-8 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2">
                Enable Useful Tools
            </h2>
            <p className="text-gray-300 mb-8">
                Give your character additional capabilities (optional)
            </p>

            <div className="space-y-4 mb-8">
                {AVAILABLE_TOOLS.map(tool => (
                    <div key={tool.id} className="border border-gray-600 bg-gray-800 rounded-lg p-4">
                        <div className="flex items-start">
                            <input
                                type="checkbox"
                                id={tool.id}
                                checked={selectedTools.has(tool.id)}
                                onChange={() => onToolToggle(tool.id)}
                                className="mt-1 h-5 w-5 text-blue-500 border-gray-600 rounded focus:ring-blue-500"
                            />
                            <div className="ml-3 flex-1">
                                <label htmlFor={tool.id} className="block">
                                    <span className="font-semibold text-white">
                                        {tool.name}
                                    </span>
                                    <p className="text-sm text-gray-300">
                                        {tool.description}
                                    </p>
                                </label>

                                {tool.requiresApiKey && selectedTools.has(tool.id) && (
                                    <div className="mt-3 space-y-2">
                                        <div className="text-sm text-gray-400">
                                            <p className="mb-1">
                                                <strong>{API_KEY_INFO[tool.id].provider} API Key</strong>
                                            </p>
                                            <p className="mb-1">
                                                {API_KEY_INFO[tool.id].instructions}
                                            </p>
                                            <a
                                                href="#"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    window.ipc.send('open-external', API_KEY_INFO[tool.id].signupUrl);
                                                }}
                                                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
                                            >
                                                Get API key →
                                            </a>
                                        </div>
                                        <SecretInput
                                            value={toolApiKeys[tool.id] || ''}
                                            onChange={(value) => onToolApiKeyChange(tool.id, value)}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                >
                    Back
                </button>
                <div className="flex gap-3">
                    <button
                        onClick={onSkip}
                        className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                    >
                        Skip
                    </button>
                    <button
                        onClick={onNext}
                        className="px-8 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold"
                    >
                        Next
                    </button>
                </div>
            </div>
        </div>
    );
}
