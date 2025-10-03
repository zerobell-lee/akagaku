export interface CharacterProperties {
    character_name: string;
    character_width: number;
    character_height: number;
    graphics: CharacterGraphics[];
    touchable_areas: TouchableArea[];
    skipGreeting?: boolean; // If true, don't trigger greeting on character load
}

export interface CharacterDisplayProperties {
    character_name: string;
    character_width: number;
    character_height: number;
    imgSrc: string;
    touchable_areas: TouchableArea[];
}

export interface CharacterGraphics {
    emoticon: string;
    imgSrc: string;
}

export interface AffectionAttitudeMap {
    conditions: {
        if_above: number;
        attitude: string;
    }[];
}

export interface TouchableArea {
    bodyPart: string;
    paths: string[];
    action_event: {
        touch: string | undefined;
        click: string | undefined;
    };
}

export interface CharacterAppearance {
    character_name: string;
    character_width: number;
    character_height: number;
    graphics: CharacterGraphics[];
    touchable_areas: TouchableArea[];
}

export interface TouchablePathProps {
    path: string;
    onTouch: () => void | undefined;
    onClick: () => void | undefined;
    onMouseLeave: () => void | undefined;
    key: string;
}

export interface TouchableArea {
    bodyPart: string;
    paths: string[];
    action_event: {
        touch: string | undefined;
        click: string | undefined;
    }
}

export interface GhostResponse {
    emoticon: string;
    message: string;
    add_affection: number;
    error?: Error;
}

export interface ConfigResponse {
    openaiApiKey: string;
    anthropicApiKey: string;
    llmService: LLMService;
    selectedModel: string;
    temperature: number;
    openweathermapApiKey: string;
    coinmarketcapApiKey: string;
    chatHistoryLimit: number;
    // New flexible configuration
    llmProvider?: LLMProvider;
    customBaseURL?: string;
    customApiKey?: string;
    // Display scaling configuration
    displayScale: number;
    speechBubbleWidth: number;
    // Performance optimization
    enableLightweightModel: boolean;
    enableAutoSummarization: boolean;
    summarizationThreshold: number;
    keepRecentMessages: number;
    // Developer settings
    langsmithApiKey?: string;
    enableLangsmithTracing?: boolean;
    langsmithProjectName?: string;
    // Speech bubble styling
    speechBubbleFontFamily?: string;
    speechBubbleFontSize?: number;
    speechBubbleCustomCSS?: string;
    // Tool configurations
    toolConfigs?: Record<string, ToolConfig>;
}

export interface ToolConfig {
    enabled: boolean;
    settings: Record<string, any>;
}

export interface UserInput {
    input: string;
    isSystemMessage: boolean;
}

export type LLMService = 'openai' | 'anthropic';

export type LLMProvider =
    | 'openai'
    | 'anthropic'
    | 'openrouter'
    | 'azure-openai'
    | 'aws-bedrock'
    | 'google-vertex'
    | 'custom';

export interface LLMConfig {
    provider: LLMProvider;
    modelName: string;
    apiKey: string;
    baseURL?: string;
    temperature: number;
    region?: string; // For AWS Bedrock
    projectId?: string; // For Google Vertex
}

// Recommended models by provider type (for UI)
export type RecommendedModelsType = Record<LLMProvider, string[]>;

export interface ChatLog {
    role: string;
    content: string;
    createdAt: Date;
}

// Skin system types
export interface SkinManifest {
    manifest_version?: string; // Manifest schema version (e.g., "1.0"), defaults to "1.0" if not present
    skin_id: string;           // e.g., "default", "summer"
    skin_name: string;         // Display name: "Default Skin", "Summer Skin"
    description: string;       // Skin description for AI context: "wearing a swimsuit"
    version: string;           // Skin content version (e.g., "1.0.0")
    author?: string;
    thumbnail?: string;        // Thumbnail image path (relative to skin directory)
                               // Spec: 256x256 PNG/JPEG/WebP, max 500KB
                               // Example: "thumbnail.png" → data/character/{character_id}/skins/{skin_id}/thumbnail.png
    created_at?: string;
}

export interface Skin {
    manifest: SkinManifest;
    appearance: CharacterAppearance;
}

export interface CharacterManifest {
    manifest_version?: string; // Manifest schema version (e.g., "1.0"), defaults to "1.0" if not present
    character_id: string;      // Unique character identifier
    character_name: string;    // Display name for the character
    description: string;       // Character description
    thumbnail?: string;        // Thumbnail image path (relative to character directory)
                               // Spec: 256x256 PNG/JPEG/WebP, max 500KB
                               // Example: "thumbnail.png" → data/character/{character_id}/thumbnail.png
    author?: string;
    created_at?: string;
    version: string;           // Character content version (e.g., "1.0.0")
}

// Onboarding system types
export interface OnboardingConfig {
    llmProvider: LLMProvider;
    apiKey: string;
    modelName?: string;
    temperature?: number;
    customBaseURL?: string;
    selectedTools?: string[]; // Tool IDs to enable
    toolApiKeys?: Record<string, string>; // Tool-specific API keys
}

export interface OnboardingSaveConfigPayload {
    llmProvider: LLMProvider;
    apiKey: string;
    modelName?: string;
    temperature?: number;
    customBaseURL?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    customApiKey?: string;
    selectedModel?: string;
    toolConfigs?: Record<string, ToolConfig>;
    openweathermapApiKey?: string;
    coinmarketcapApiKey?: string;
}