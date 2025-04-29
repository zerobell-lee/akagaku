export interface CharacterProperties {
    character_name: string;
    character_width: number;
    character_height: number;
    graphics: CharacterGraphics[];
    touchable_areas: TouchableArea[];
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
    llmService: llmService;
    selectedModel: string;
    temperature: number;
    openweathermapApiKey: string;
    coinmarketcapApiKey: string;
    chatHistoryLimit: number;
}

export interface UserInput {
    input: string;
    isSystemMessage: boolean;
}

export type llmService = 'openai' | 'anthropic';
