import { app, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { GhostService } from '../../infrastructure/ghost/GhostService';
import { ConfigRepository } from '../../infrastructure/config/ConfigRepository';
import { ToolConfigRepository } from '../../infrastructure/tools/ToolConfigRepository';
import { ToolRegistry } from '../../domain/services/ToolRegistry';
import { UserActionHandler } from './UserActionHandler';
import { IIPCHandler } from '../ipc/IIPCHandler';
import { setDisplayScale, setSpeechBubbleWidth } from '../../background';

/**
 * Configuration data transfer object
 */
export interface ConfigData {
  openaiApiKey?: string;
  anthropicApiKey?: string;
  llmService?: string;
  selectedModel?: string;
  temperature?: number;
  openweathermapApiKey?: string;
  coinmarketcapApiKey?: string;
  chatHistoryLimit?: number;
  displayScale?: number;
  speechBubbleWidth?: number;
  enableLightweightModel?: boolean;
  enableAutoSummarization?: boolean;
  summarizationThreshold?: number;
  langsmithApiKey?: string;
  enableLangsmithTracing?: boolean;
  langsmithProjectName?: string;
  speechBubbleFontFamily?: string;
  speechBubbleFontSize?: number;
  speechBubbleCustomCSS?: string;
  toolConfigs?: Record<string, any>;
}

/**
 * ConfigHandler - Presentation layer handler for configuration management
 *
 * Handles all configuration-related operations including:
 * - Saving and updating configuration
 * - LLM service configuration updates
 * - Tool configuration management
 * - LangSmith tracing configuration
 * - Speech bubble styling
 */
export class ConfigHandler implements IIPCHandler {
  private configRepository: ConfigRepository;
  private toolConfigRepository: ToolConfigRepository;
  private toolRegistry: ToolRegistry;
  private ghost: GhostService;
  private userActionHandler: UserActionHandler;

  constructor({
    configRepository,
    toolConfigRepository,
    toolRegistry,
    ghost,
    userActionHandler
  }: {
    configRepository: ConfigRepository;
    toolConfigRepository: ToolConfigRepository;
    toolRegistry: ToolRegistry;
    ghost: GhostService;
    userActionHandler: UserActionHandler;
  }) {
    this.configRepository = configRepository;
    this.toolConfigRepository = toolConfigRepository;
    this.toolRegistry = toolRegistry;
    this.ghost = ghost;
    this.userActionHandler = userActionHandler;
  }

  /**
   * Handle save_config action
   * Saves all configuration changes and applies updates
   */
  async saveConfig(config: ConfigData): Promise<void> {
    console.log('[ConfigHandler] Saving configuration:', {
      llmService: config.llmService,
      selectedModel: config.selectedModel,
      temperature: config.temperature,
      speechBubbleFontFamily: config.speechBubbleFontFamily,
      speechBubbleFontSize: config.speechBubbleFontSize
    });

    // Get previous values for comparison
    const previous = this.getPreviousConfig();

    // Track if LLM update is required
    let updateRequired = false;

    // Update LLM-related configurations
    updateRequired = this.updateLLMConfig(config, previous) || updateRequired;

    // Update API keys (non-LLM)
    this.updateAPIKeys(config, previous);

    // Update general settings
    this.updateGeneralSettings(config, previous);

    // Handle app restart requirements
    if (this.requiresRestart(config, previous)) {
      // Set flag to skip greeting on restart
      this.configRepository.setConfig('skipNextGreeting', true);
      app.relaunch();
      app.quit();
      return;
    }

    // Update LangSmith tracing
    this.updateLangSmithConfig(config);

    // Update speech bubble styling
    this.updateSpeechBubbleStyle(config);

    // Update tool configurations
    const toolConfigChanged = this.updateToolConfigs(config.toolConfigs);

    // Update ghost service if LLM or tool config changed
    if (updateRequired || toolConfigChanged) {
      this.updateGhostService(config);
    }
  }

  /**
   * Get previous configuration values
   */
  private getPreviousConfig() {
    return {
      openaiApiKey: this.configRepository.getConfig('openaiApiKey') as string || "",
      anthropicApiKey: this.configRepository.getConfig('anthropicApiKey') as string || "",
      llmService: this.configRepository.getConfig('llmService') as string || "",
      selectedModel: this.configRepository.getConfig('selectedModel') as string || "",
      temperature: this.configRepository.getConfig('temperature') as number || 1,
      openweathermapApiKey: this.configRepository.getConfig('openweathermapApiKey') as string || "",
      coinmarketcapApiKey: this.configRepository.getConfig('coinmarketcapApiKey') as string || "",
      chatHistoryLimit: this.configRepository.getConfig('chatHistoryLimit') as number || 20,
      displayScale: this.configRepository.getConfig('displayScale') as number || 0.5,
      speechBubbleWidth: this.configRepository.getConfig('speechBubbleWidth') as number || 500
    };
  }

  /**
   * Update LLM-related configuration
   * Returns true if LLM service needs to be updated
   */
  private updateLLMConfig(config: ConfigData, previous: ReturnType<typeof this.getPreviousConfig>): boolean {
    let updateRequired = false;

    if (config.openaiApiKey !== undefined && previous.openaiApiKey !== config.openaiApiKey) {
      this.configRepository.setConfig('openaiApiKey', config.openaiApiKey);
      updateRequired = true;
    }

    if (config.anthropicApiKey !== undefined && previous.anthropicApiKey !== config.anthropicApiKey) {
      this.configRepository.setConfig('anthropicApiKey', config.anthropicApiKey);
      updateRequired = true;
    }

    if (config.llmService !== undefined && config.selectedModel !== undefined &&
        (previous.llmService !== config.llmService || previous.selectedModel !== config.selectedModel)) {
      this.configRepository.setConfig('llmService', config.llmService);
      this.configRepository.setConfig('selectedModel', config.selectedModel);
      updateRequired = true;
    }

    if (config.temperature !== undefined && previous.temperature !== config.temperature) {
      this.configRepository.setConfig('temperature', config.temperature);
      updateRequired = true;
    }

    return updateRequired;
  }

  /**
   * Update non-LLM API keys
   */
  private updateAPIKeys(config: ConfigData, previous: ReturnType<typeof this.getPreviousConfig>): void {
    if (config.openweathermapApiKey !== undefined && previous.openweathermapApiKey !== config.openweathermapApiKey) {
      this.configRepository.setConfig('openweathermapApiKey', config.openweathermapApiKey);
    }

    if (config.coinmarketcapApiKey !== undefined && previous.coinmarketcapApiKey !== config.coinmarketcapApiKey) {
      this.configRepository.setConfig('coinmarketcapApiKey', config.coinmarketcapApiKey);
    }
  }

  /**
   * Update general settings
   */
  private updateGeneralSettings(config: ConfigData, previous: ReturnType<typeof this.getPreviousConfig>): void {
    if (config.chatHistoryLimit !== undefined) {
      this.configRepository.setConfig('chatHistoryLimit', config.chatHistoryLimit);
    }

    if (config.enableLightweightModel !== undefined) {
      this.configRepository.setConfig('enableLightweightModel', config.enableLightweightModel);
    }

    if (config.enableAutoSummarization !== undefined) {
      this.configRepository.setConfig('enableAutoSummarization', config.enableAutoSummarization);
    }

    if (config.summarizationThreshold !== undefined) {
      this.configRepository.setConfig('summarizationThreshold', config.summarizationThreshold);
    }

    if (config.keepRecentMessages !== undefined) {
      this.configRepository.setConfig('keepRecentMessages', config.keepRecentMessages);
    }
  }

  /**
   * Check if configuration changes require app restart
   */
  private requiresRestart(config: ConfigData, previous: ReturnType<typeof this.getPreviousConfig>): boolean {
    if (config.displayScale !== undefined && previous.displayScale !== config.displayScale) {
      this.configRepository.setConfig('displayScale', config.displayScale);
      this.userActionHandler.updateDisplayScale(config.displayScale);
      setDisplayScale(config.displayScale);
      return true;
    }

    if (config.speechBubbleWidth !== undefined && previous.speechBubbleWidth !== config.speechBubbleWidth) {
      this.configRepository.setConfig('speechBubbleWidth', config.speechBubbleWidth);
      this.userActionHandler.updateSpeechBubbleWidth(config.speechBubbleWidth);
      setSpeechBubbleWidth(config.speechBubbleWidth);
      return true;
    }

    return false;
  }

  /**
   * Update LangSmith tracing configuration
   */
  private updateLangSmithConfig(config: ConfigData): void {
    // Save developer settings
    this.configRepository.setConfig('langsmithApiKey', config.langsmithApiKey || '');
    this.configRepository.setConfig('enableLangsmithTracing', config.enableLangsmithTracing || false);
    this.configRepository.setConfig('langsmithProjectName', config.langsmithProjectName || 'akagaku');

    // Update LangSmith environment variables
    if (config.enableLangsmithTracing && config.langsmithApiKey) {
      process.env.LANGCHAIN_TRACING_V2 = "true";
      process.env.LANGCHAIN_API_KEY = config.langsmithApiKey;
      process.env.LANGCHAIN_PROJECT = config.langsmithProjectName || 'akagaku';
      console.log('[LangSmith] Tracing enabled for project:', config.langsmithProjectName);
    } else {
      process.env.LANGCHAIN_TRACING_V2 = "false";
      console.log('[LangSmith] Tracing disabled');
    }
  }

  /**
   * Update speech bubble styling
   */
  private updateSpeechBubbleStyle(config: ConfigData): void {
    console.log('[ConfigHandler] updateSpeechBubbleStyle called with:', {
      fontFamily: config.speechBubbleFontFamily,
      fontSize: config.speechBubbleFontSize,
      customCSS: config.speechBubbleCustomCSS
    });

    // Save speech bubble styling
    if (config.speechBubbleFontFamily !== undefined) {
      console.log('[ConfigHandler] Saving speechBubbleFontFamily:', config.speechBubbleFontFamily);
      this.configRepository.setConfig('speechBubbleFontFamily', config.speechBubbleFontFamily);
    }

    if (config.speechBubbleFontSize !== undefined) {
      console.log('[ConfigHandler] Saving speechBubbleFontSize:', config.speechBubbleFontSize);
      this.configRepository.setConfig('speechBubbleFontSize', config.speechBubbleFontSize);
    }

    if (config.speechBubbleCustomCSS !== undefined) {
      console.log('[ConfigHandler] Saving speechBubbleCustomCSS:', config.speechBubbleCustomCSS);
      this.configRepository.setConfig('speechBubbleCustomCSS', config.speechBubbleCustomCSS);
    }

    // Send updated config to speech bubble window
    const speechBubbleWindow = this.userActionHandler.getSpeechBubbleWindow();
    if (speechBubbleWindow) {
      speechBubbleWindow.webContents.send('update-speech-bubble-style', {
        fontFamily: config.speechBubbleFontFamily,
        fontSize: config.speechBubbleFontSize,
        customCSS: config.speechBubbleCustomCSS
      });
    }
  }

  /**
   * Update tool configurations
   * Returns true if tool config changed
   */
  private updateToolConfigs(toolConfigs?: Record<string, any>): boolean {
    if (!toolConfigs) {
      return false;
    }

    this.toolConfigRepository.saveAllToolConfigs(toolConfigs);

    // Update ToolRegistry with new configs
    Object.entries(toolConfigs).forEach(([toolId, config]) => {
      this.toolRegistry.updateToolConfig(toolId, config as any);
    });

    console.log('[ToolRegistry] Updated with new configs. Enabled tools:', this.toolRegistry.getEnabledToolIds());
    return true;
  }

  /**
   * Update ghost service with new LLM configuration
   */
  private updateGhostService(config: ConfigData): void {
    this.ghost.updateExecuter({
      openaiApiKey: config.openaiApiKey || "",
      anthropicApiKey: config.anthropicApiKey || "",
      llmService: (config.llmService as 'openai' | 'anthropic') || 'openai',
      modelName: config.selectedModel || "",
      temperature: config.temperature || 1
    });
  }

  /**
   * Get system fonts
   */
  async getSystemFonts(): Promise<string[]> {
    try {
      const fontList = require('font-list');
      const fonts = await fontList.getFonts();
      return fonts;
    } catch (error) {
      console.error('[ConfigHandler] Failed to get system fonts:', error);
      return [];
    }
  }

  /**
   * Get available tools metadata
   */
  getAvailableTools() {
    return this.toolRegistry.getAllToolsMetadata();
  }

  // IIPCHandler implementation
  getEventNames(): string[] {
    return ['save_config'];
  }

  getInvokeEventNames(): string[] {
    return ['get-system-fonts', 'get-available-tools'];
  }

  canHandle(eventName: string): boolean {
    return this.getEventNames().includes(eventName) || this.getInvokeEventNames().includes(eventName);
  }

  async handle(eventName: string, event: IpcMainEvent, ...args: any[]): Promise<void> {
    if (eventName === 'save_config') {
      await this.saveConfig(args[0] as ConfigData);
    }
  }

  async handleInvoke(eventName: string, event: IpcMainInvokeEvent, ...args: any[]): Promise<any> {
    switch (eventName) {
      case 'get-system-fonts':
        return await this.getSystemFonts();
      case 'get-available-tools':
        return this.getAvailableTools();
      default:
        throw new Error(`Unknown invoke event: ${eventName}`);
    }
  }
}
