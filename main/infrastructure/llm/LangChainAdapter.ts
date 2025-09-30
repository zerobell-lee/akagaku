import { ILLMService, IMessageParser, IMessageConverter } from 'main/application/ports/ILLMService';
import { BaseMessage, HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { AkagakuBaseMessage, AkagakuUserMessage, AkagakuSystemMessage, AkagakuCharacterMessage } from 'main/domain/message/AkagakuMessage';

export class LangChainAdapter implements ILLMService, IMessageParser, IMessageConverter {
    private graph: any;

    constructor(graph: any) {
        this.graph = graph;
    }

    async invoke(payload: Record<string, any>): Promise<any> {
        const result = await this.graph.invoke(payload, {
            recursionLimit: 100
        });
        return result;
    }

    parseGhostResponse(response: any): any {
        // Parse the LLM response format
        // Expected format: <response>...</response><add_affection>...</add_affection><emoticon>...</emoticon>
        const responseMatch = response.match(/<response>(.*?)<\/response>/s);
        const affectionMatch = response.match(/<add_affection>(.*?)<\/add_affection>/);
        const emoticonMatch = response.match(/<emoticon>(.*?)<\/emoticon>/);

        return {
            response: responseMatch ? responseMatch[1].trim() : response,
            add_affection: affectionMatch ? parseInt(affectionMatch[1]) : 0,
            emoticon: emoticonMatch ? emoticonMatch[1].trim() : 'neutral'
        };
    }

    convertToLangChainMessage(message: AkagakuBaseMessage): BaseMessage {
        switch (message.type) {
            case 'user':
                return new HumanMessage(message.content);
            case 'system':
                return new SystemMessage(message.content);
            case 'character':
                return new AIMessage(message.content);
            default:
                throw new Error(`Unknown message type: ${message.type}`);
        }
    }

    convertFromLangChainMessage(message: BaseMessage, characterName?: string): AkagakuBaseMessage {
        if (message._getType() === 'human') {
            return new AkagakuUserMessage({
                content: message.content as string,
                createdAt: new Date()
            });
        } else if (message._getType() === 'system') {
            return new AkagakuSystemMessage({
                content: message.content as string,
                createdAt: new Date()
            });
        } else if (message._getType() === 'ai') {
            return new AkagakuCharacterMessage({
                content: message.content as string,
                characterName: characterName || 'unknown',
                emoticon: 'neutral',
                createdAt: new Date()
            });
        } else {
            throw new Error(`Unknown LangChain message type: ${message._getType()}`);
        }
    }
}