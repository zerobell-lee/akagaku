import { LLMProvider } from '@shared/types';

interface CompleteStepProps {
    provider: LLMProvider;
    selectedTools: Set<string>;
    onComplete: () => void;
    onBack: () => void;
}

const PROVIDER_LABELS: Record<LLMProvider, string> = {
    'openai': 'OpenAI',
    'anthropic': 'Anthropic',
    'openrouter': 'OpenRouter',
    'azure-openai': 'Azure OpenAI',
    'aws-bedrock': 'AWS Bedrock',
    'google-vertex': 'Google Vertex AI',
    'custom': 'Custom'
};

const TOOL_LABELS: Record<string, string> = {
    'get_weather': 'Weather',
    'get_crypto_price': 'Cryptocurrency',
    'open_url': 'Browser',
    'open_app': 'Applications'
};

export function CompleteStep({
    provider,
    selectedTools,
    onComplete,
    onBack
}: CompleteStepProps) {
    return (
        <div className="flex flex-col items-center px-8 max-w-2xl mx-auto text-center">
            <div className="mb-6">
                <svg
                    className="w-24 h-24 mx-auto text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            </div>

            <h2 className="text-4xl font-bold text-white mb-4">
                All Set! 🎉
            </h2>

            <p className="text-lg text-gray-300 mb-8">
                Your character is ready to chat with you
            </p>

            <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 mb-8 text-left w-full">
                <h3 className="font-semibold text-white mb-3">Configuration Summary</h3>

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-400">AI Provider:</span>
                        <span className="font-medium text-white">
                            {PROVIDER_LABELS[provider]}
                        </span>
                    </div>

                    {selectedTools.size > 0 && (
                        <div className="flex justify-between">
                            <span className="text-gray-400">Enabled Tools:</span>
                            <span className="font-medium text-white">
                                {Array.from(selectedTools).map(id => TOOL_LABELS[id] || id).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-between w-full">
                <button
                    onClick={onBack}
                    className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onComplete}
                    className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-lg font-semibold"
                >
                    Start Chatting
                </button>
            </div>
        </div>
    );
}
