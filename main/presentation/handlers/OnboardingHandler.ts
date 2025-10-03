import { IpcMainEvent } from 'electron';
import { ConfigRepository } from '../../infrastructure/config/ConfigRepository';
import { ToolConfigRepository } from '../../infrastructure/tools/ToolConfigRepository';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { OnboardingSaveConfigPayload } from '@shared/types';

/**
 * OnboardingHandler - Handles onboarding IPC events
 *
 * Responsibilities:
 * - Save user configuration from onboarding flow
 * - Handle onboarding completion
 */
export class OnboardingHandler implements IIPCHandler {
    private configRepository: ConfigRepository;
    private toolConfigRepository: ToolConfigRepository;
    private onComplete: (() => void) | null = null;

    constructor({
        configRepository,
        toolConfigRepository
    }: {
        configRepository: ConfigRepository;
        toolConfigRepository: ToolConfigRepository;
    }) {
        this.configRepository = configRepository;
        this.toolConfigRepository = toolConfigRepository;
    }

    /**
     * Set callback to be called when onboarding is complete
     * This will trigger ghost window creation
     */
    setOnComplete(callback: () => void): void {
        this.onComplete = callback;
    }

    getEventNames(): string[] {
        return ['onboarding-save-config', 'onboarding-complete'];
    }

    canHandle(eventName: string): boolean {
        return this.getEventNames().includes(eventName);
    }

    async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
        if (eventName === 'onboarding-save-config') {
            await this.handleSaveConfig(args[0] as OnboardingSaveConfigPayload);
        } else if (eventName === 'onboarding-complete') {
            await this.handleComplete();
        }
    }

    /**
     * Handle onboarding-save-config event
     * Saves all configuration from onboarding flow
     */
    private async handleSaveConfig(payload: OnboardingSaveConfigPayload): Promise<void> {
        console.log('[OnboardingHandler] Saving onboarding configuration');

        // Save LLM configuration
        if (payload.llmProvider) {
            this.configRepository.setConfig('llmProvider', payload.llmProvider);
        }

        if (payload.selectedModel) {
            this.configRepository.setConfig('selectedModel', payload.selectedModel);
        }

        if (payload.temperature !== undefined) {
            this.configRepository.setConfig('temperature', payload.temperature);
        }

        // Save API keys
        if (payload.openaiApiKey) {
            this.configRepository.setConfig('openaiApiKey', payload.openaiApiKey);
        }

        if (payload.anthropicApiKey) {
            this.configRepository.setConfig('anthropicApiKey', payload.anthropicApiKey);
        }

        if (payload.customApiKey) {
            this.configRepository.setConfig('customApiKey', payload.customApiKey);
        }

        if (payload.customBaseURL) {
            this.configRepository.setConfig('customBaseURL', payload.customBaseURL);
        }

        // Save tool configurations
        if (payload.toolConfigs) {
            Object.entries(payload.toolConfigs).forEach(([toolId, config]) => {
                this.toolConfigRepository.setToolConfig(toolId, config);
            });
        }

        // Save tool API keys
        if (payload.openweathermapApiKey) {
            this.configRepository.setConfig('openweathermapApiKey', payload.openweathermapApiKey);
        }

        if (payload.coinmarketcapApiKey) {
            this.configRepository.setConfig('coinmarketcapApiKey', payload.coinmarketcapApiKey);
        }

        // Legacy compatibility - save to old llmService field
        if (payload.llmProvider === 'openai' || payload.llmProvider === 'anthropic') {
            this.configRepository.setConfig('llmService', payload.llmProvider);
        }

        console.log('[OnboardingHandler] Configuration saved successfully');
    }

    /**
     * Handle onboarding-complete event
     * Triggers ghost window creation and closes onboarding window
     */
    private async handleComplete(): Promise<void> {
        console.log('[OnboardingHandler] Onboarding complete');

        if (this.onComplete) {
            this.onComplete();
        }
    }
}
