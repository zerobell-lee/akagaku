import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatLog, GhostResponse, LLMService } from "@shared/types";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { UserInput } from "main/domain/ghost/graph/states";

export interface AkagakuBaseMessage {
    type: string;
    createdAt: Date;
    content: any;
    toChatLog: () => ChatLog;
}

export class AkagakuUserMessage implements AkagakuBaseMessage {
    type = 'user';
    content: string;
    createdAt: Date;

    constructor({
        content,
        createdAt
    }: {
        content: string;
        createdAt: Date;
    }) {
        this.content = content;
        this.createdAt = createdAt;
    }

    toChatLog(): ChatLog {
        return {
            role: 'user',
            content: this.content,
            createdAt: this.createdAt
        }
    }
}

export class AkagakuSystemMessage implements AkagakuBaseMessage {
    type = 'system';
    content: string;
    createdAt: Date;

    constructor({
        content,
        createdAt
    }: {
        content: string;
        createdAt: Date;
    }) {
        this.content = content;
        this.createdAt = createdAt;
    }

    toChatLog(): ChatLog {
        return {
            role: 'system',
            content: this.content,
            createdAt: this.createdAt
        }
    }
}

export class AkagakuCharacterMessage implements AkagakuBaseMessage {
    type = 'character';
    content: GhostResponse;
    createdAt: Date;

    constructor({
        content,
        createdAt
    }: {
        content: GhostResponse;
        createdAt: Date;
    }) {
        this.content = content;
        this.createdAt = createdAt;
    }

    toChatLog(): ChatLog {
        return {
            role: 'character',
            content: this.content.message,
            createdAt: this.createdAt
        }
    }
}

export function createMessageFromUserInput(userInput: UserInput, createdAt: Date = new Date()): AkagakuBaseMessage {
    if (userInput.isSystemMessage) {
        return new AkagakuSystemMessage({
            content: userInput.payload,
            createdAt: createdAt
        });
    }
    return new AkagakuUserMessage({
        content: userInput.payload,
        createdAt: createdAt
    });
}

export class AkagakuMessageConverter {
    private llmService: LLMService
    constructor(llmService: LLMService) {
        this.llmService = llmService
    }

    convertToLangChainMessage(message: AkagakuBaseMessage): BaseMessage {
        let content = message.content
        if (message.type === 'character') {
            content = (message.content as GhostResponse).message
        }
        const formattedMessageContent = `${formatDatetime(message.createdAt)}|${content}`
        if (message.type === 'user') {
            return new HumanMessage(formattedMessageContent)
        } else if (message.type === 'system') {
            if (this.llmService === 'anthropic') {
                return new HumanMessage(formattedMessageContent, { role: 'system' })
            }
            return new SystemMessage(formattedMessageContent)
        } else if (message.type === 'character') {
            return new AIMessage(formattedMessageContent)
        }
    }
}