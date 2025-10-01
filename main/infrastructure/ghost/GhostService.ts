import { GhostResponse, LLMService } from "@shared/types";
import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { llmProperties } from "main/domain/ghost/graph/states";
import { Ghost } from "main/domain/ghost/ghost_graph";
import { ToolRegistry } from "main/domain/services/ToolRegistry";

/**
 * GhostService - Infrastructure layer service for character conversation
 *
 * This service acts as a facade between the UI layer and the domain layer.
 * It wraps the Ghost class while maintaining Clean Architecture boundaries.
 *
 * Note: The Ghost class internally uses LangGraph which is treated as an
 * infrastructure detail. Future refactoring can extract use cases from Ghost.
 */
export class GhostService {
    private ghost: Ghost;

    constructor({ llm_properties, character_setting, toolRegistry }: {
        llm_properties: llmProperties,
        character_setting: CharacterSetting,
        toolRegistry?: ToolRegistry
    }) {
        // Delegate to the existing Ghost implementation
        this.ghost = new Ghost({ llm_properties, character_setting, toolRegistry });
    }

    async invoke({ input, isSystemMessage }: {
        input: string,
        isSystemMessage: boolean
    }): Promise<GhostResponse> {
        return await this.ghost.invoke({ input, isSystemMessage });
    }

    isNewRendezvous(): boolean {
        return this.ghost.isNewRendezvous();
    }

    async resetChatHistory(): Promise<void> {
        return await this.ghost.resetChatHistory();
    }

    async sayHello(): Promise<GhostResponse> {
        return await this.ghost.sayHello();
    }

    async sayGoodbye(): Promise<GhostResponse> {
        return await this.ghost.sayGoodbye();
    }

    async doChitChat(): Promise<GhostResponse> {
        return await this.ghost.doChitChat();
    }

    async sendRawMessage({ input, isSystemMessage }: {
        input: string,
        isSystemMessage: boolean
    }): Promise<GhostResponse> {
        return await this.ghost.sendRawMessage({ input, isSystemMessage });
    }

    async updateExecuter({
        openaiApiKey,
        anthropicApiKey,
        llmService,
        modelName,
        temperature
    }: {
        openaiApiKey: string | null,
        anthropicApiKey: string | null,
        llmService: string | null,
        modelName: string | null,
        temperature: number
    }): Promise<void> {
        return await this.ghost.updateExecuter({
            openaiApiKey,
            anthropicApiKey,
            llmService,
            modelName,
            temperature
        });
    }
}