import { LLMProvider } from '@shared/types';
import { SecretInput } from '../SecretInput';

interface AIProviderStepProps {
    provider: LLMProvider;
    apiKey: string;
    onProviderChange: (provider: LLMProvider) => void;
    onApiKeyChange: (apiKey: string) => void;
    onNext: () => void;
    onBack: () => void;
}

const PROVIDER_INFO: Record<LLMProvider, { label: string; description: string; placeholder: string }> = {
    'openai': {
        label: 'OpenAI',
        description: 'GPT-4, GPT-5 and other OpenAI models',
        placeholder: 'sk-...'
    },
    'anthropic': {
        label: 'Anthropic (Recommended)',
        description: 'Claude 4 Sonnet and Opus - Most reliable and capable',
        placeholder: 'sk-ant-...'
    },
    'openrouter': {
        label: 'OpenRouter',
        description: 'Access to multiple providers through one API',
        placeholder: 'sk-or-...'
    },
    'azure-openai': {
        label: 'Azure OpenAI',
        description: 'Enterprise OpenAI through Azure',
        placeholder: 'Your Azure API key'
    },
    'aws-bedrock': {
        label: 'AWS Bedrock',
        description: 'Claude and other models on AWS',
        placeholder: 'Your AWS access key'
    },
    'google-vertex': {
        label: 'Google Vertex AI',
        description: 'Gemini and other models on Google Cloud',
        placeholder: 'Your Google Cloud API key'
    },
    'custom': {
        label: 'Custom',
        description: 'Custom OpenAI-compatible endpoint',
        placeholder: 'Your API key'
    }
};

export function AIProviderStep({
    provider,
    apiKey,
    onProviderChange,
    onApiKeyChange,
    onNext,
    onBack
}: AIProviderStepProps) {
    const isValid = apiKey.trim().length > 0;

    return (
        <div className="flex flex-col px-8 max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-2">
                Choose Your AI Provider
            </h2>
            <p className="text-gray-300 mb-8">
                Select the AI service you want to use for your character
            </p>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    Provider
                </label>
                <select
                    value={provider}
                    onChange={(e) => onProviderChange(e.target.value as LLMProvider)}
                    className="w-full px-4 py-2 bg-gray-700 text-white border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                        <option key={key} value={key}>
                            {info.label}
                        </option>
                    ))}
                </select>
                <p className="mt-2 text-sm text-gray-400">
                    {PROVIDER_INFO[provider].description}
                </p>
            </div>

            <div className="mb-8">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key <span className="text-red-500">*</span>
                </label>
                <SecretInput
                    value={apiKey}
                    onChange={onApiKeyChange}
                />
                <p className="mt-2 text-sm text-gray-400">
                    Your API key is stored locally and never shared
                </p>
            </div>

            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-6 py-2 text-gray-300 hover:text-white transition-colors"
                >
                    Back
                </button>
                <button
                    onClick={onNext}
                    disabled={!isValid}
                    className={`px-8 py-2 rounded-lg text-white font-semibold transition-colors ${
                        isValid
                            ? 'bg-blue-500 hover:bg-blue-600'
                            : 'bg-gray-600 cursor-not-allowed'
                    }`}
                >
                    Next
                </button>
            </div>
        </div>
    );
}
