import { useState } from 'react';
import { LLMProvider, OnboardingSaveConfigPayload, ToolConfig } from '@shared/types';
import { StepIndicator } from '../components/onboarding/StepIndicator';
import { WelcomeStep } from '../components/onboarding/WelcomeStep';
import { AIProviderStep } from '../components/onboarding/AIProviderStep';
import { ToolSetupStep } from '../components/onboarding/ToolSetupStep';
import { CompleteStep } from '../components/onboarding/CompleteStep';

const TOTAL_STEPS = 4;

export default function Onboarding() {
    const [currentStep, setCurrentStep] = useState(1);
    const [provider, setProvider] = useState<LLMProvider>('anthropic');
    const [apiKey, setApiKey] = useState('');
    const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
    const [toolApiKeys, setToolApiKeys] = useState<Record<string, string>>({});

    const handleNext = () => {
        if (currentStep < TOTAL_STEPS) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleToolToggle = (toolId: string) => {
        setSelectedTools(prev => {
            const newSet = new Set(prev);
            if (newSet.has(toolId)) {
                newSet.delete(toolId);
                // Clear API key when tool is disabled
                const { [toolId]: _, ...rest } = toolApiKeys;
                setToolApiKeys(rest);
            } else {
                newSet.add(toolId);
            }
            return newSet;
        });
    };

    const handleToolApiKeyChange = (toolId: string, value: string) => {
        setToolApiKeys(prev => ({ ...prev, [toolId]: value }));
    };

    const handleComplete = () => {
        // Prepare config payload
        const payload: OnboardingSaveConfigPayload = {
            llmProvider: provider,
            apiKey: apiKey,
            selectedModel: getDefaultModel(provider),
            temperature: 1,
        };

        // Map provider to specific API key field
        if (provider === 'openai' || provider === 'azure-openai') {
            payload.openaiApiKey = apiKey;
        } else if (provider === 'anthropic') {
            payload.anthropicApiKey = apiKey;
        } else {
            payload.customApiKey = apiKey;
        }

        // Add tool configurations
        const toolConfigs: Record<string, ToolConfig> = {};
        selectedTools.forEach(toolId => {
            toolConfigs[toolId] = {
                enabled: true,
                settings: {}
            };
        });
        payload.toolConfigs = toolConfigs;

        // Add tool API keys
        if (toolApiKeys['get_weather']) {
            payload.openweathermapApiKey = toolApiKeys['get_weather'];
        }
        if (toolApiKeys['get_crypto_price']) {
            payload.coinmarketcapApiKey = toolApiKeys['get_crypto_price'];
        }

        // Send to main process
        window.ipc.send('onboarding-save-config', payload);
        window.ipc.send('onboarding-complete');
    };

    const getDefaultModel = (provider: LLMProvider): string => {
        switch (provider) {
            case 'openai':
            case 'azure-openai':
                return 'gpt-5';
            case 'anthropic':
                return 'claude-sonnet-4-5-20250929';
            case 'openrouter':
                return 'anthropic/claude-sonnet-4.5';
            case 'aws-bedrock':
                return 'anthropic.claude-sonnet-4-v1';
            case 'google-vertex':
                return 'gemini-2.0-pro';
            default:
                return 'gpt-5';
        }
    };

    return (
        <div className="min-h-screen bg-gray-800 flex items-center justify-center p-8">
            <div className="bg-gray-900 text-white rounded-2xl shadow-xl w-full max-w-4xl p-8">
                <StepIndicator currentStep={currentStep} totalSteps={TOTAL_STEPS} />

                {currentStep === 1 && (
                    <WelcomeStep onNext={handleNext} />
                )}

                {currentStep === 2 && (
                    <AIProviderStep
                        provider={provider}
                        apiKey={apiKey}
                        onProviderChange={setProvider}
                        onApiKeyChange={setApiKey}
                        onNext={handleNext}
                        onBack={handleBack}
                    />
                )}

                {currentStep === 3 && (
                    <ToolSetupStep
                        selectedTools={selectedTools}
                        toolApiKeys={toolApiKeys}
                        onToolToggle={handleToolToggle}
                        onToolApiKeyChange={handleToolApiKeyChange}
                        onNext={handleNext}
                        onBack={handleBack}
                        onSkip={handleNext}
                    />
                )}

                {currentStep === 4 && (
                    <CompleteStep
                        provider={provider}
                        selectedTools={selectedTools}
                        onComplete={handleComplete}
                        onBack={handleBack}
                    />
                )}
            </div>
        </div>
    );
}
