import { BaseMessage } from "@langchain/core/messages";
import { getCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { GhostState } from "../states";
import { CharacterSettingLoader } from "main/infrastructure/character/CharacterRepository";
import { AIResponseParseError } from "main/infrastructure/message/MessageParser";
import { AkagakuCharacterMessage, createMessageFromUserInput } from "main/domain/message/AkagakuMessage";
import { RunnableLambda } from "@langchain/core/runnables";
import { Affection } from "main/domain/value-objects/Affection";
import { Attitude } from "main/domain/value-objects/Attitude";
import { Relationship } from "main/domain/entities/Relationship";
import { PerformanceMonitor } from "../utils/PerformanceMonitor";
import { StreamingMessageParser } from "main/infrastructure/message/StreamingMessageParser";
import { streamingEvents } from "../utils/StreamingEventEmitter";
import { GhostResponse } from "@shared/types";
import { findEmoticonWithFallback } from "main/infrastructure/utils/EmoticonMatcher";

const getCurrentTimestamp = (sentAt: Date) => {
    return formatDatetime(sentAt);
}

const getCurrentAttitude = (characterName: string, affection: Affection): Attitude => {
    const attitudeString = CharacterSettingLoader.calcAttitude(characterName, affection.getValue());
    return Attitude.create(attitudeString);
}

const convertContextInputs = (fieldName: string, input: any): string => {
    // Optimized: Use compact string format instead of JSON.stringify
    if (Array.isArray(input)) {
        if (input.length === 0) return `${fieldName} = []`;
        if (typeof input[0] === 'string') {
            return `${fieldName} = ${input.join(', ')}`;
        }
        // For message arrays, use minimal format
        return `${fieldName} = ${input.map(msg => {
            if (msg._getType) {
                const type = msg._getType();
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
                return `[${type}] ${content}`;
            }
            return JSON.stringify(msg);
        }).join('\n')}`;
    }

    if (typeof input === 'object' && input !== null) {
        // For objects, use compact key=value format with proper nested array handling
        const entries = Object.entries(input);
        return `${fieldName} = ${entries.map(([k, v]) => {
            if (Array.isArray(v)) {
                return `${k}=${v.join(',')}`;
            } else if (typeof v === 'object' && v !== null) {
                return `${k}=${JSON.stringify(v)}`;
            }
            return `${k}=${v}`;
        }).join(', ')}`;
    }

    return `${fieldName} = ${input}`;
}

export const ResponseNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { userInput, character_setting, user_setting, toolCallFinalAnswer, conversationAgent, aiResponseParser, invocation_result, chat_history, messageConverter } = state;
        const currentTrialCount = invocation_result?.trial_count ? invocation_result.trial_count + 1 : 1;
        const characterId = character_setting.character_id;

        if (!conversationAgent) {
            return {
                invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'apiKeyNotDefined', error_message: 'API key is not defined' }
            }
        }

        const sentAt = new Date();
        const rawRelationship = getCharacterRelationships(characterId)
        let relationship = Relationship.fromRaw(rawRelationship);
        let newMessage = createMessageFromUserInput(userInput, sentAt)
        let langchainChatHistory: BaseMessage[] = chat_history.getMessages().map((message) => messageConverter.convertToLangChainMessage(message));

        // Add current message to chat_history (will be properly formatted by messageConverter)
        const currentMessageAsLangChain = messageConverter.convertToLangChainMessage(newMessage);
        langchainChatHistory.push(currentMessageAsLangChain);

        // Optimized: Only send essential character_setting fields to reduce token usage
        const essentialCharacterSetting = {
            name: character_setting.name || character_setting.character_name,
            dialogue_style: character_setting.dialogue_style,
            personality: character_setting.dialogue_style?.personality,
            background: character_setting.background
        };

        const payload = {
            character_setting: convertContextInputs('Character', essentialCharacterSetting),
            user_setting: convertContextInputs('User', user_setting),
            chat_history: langchainChatHistory,
            available_emoticon: `Available emoticons: ${character_setting.available_emoticon || '["neutral"]'}`,
            relationship: convertContextInputs('Relationship', relationship.toRaw()),
            current_appearance: `Current appearance: ${state.currentSkinDescription}`,
            tool_call_result: toolCallFinalAnswer ? `Tool results:\n${toolCallFinalAnswer}` : ''
        }

        PerformanceMonitor.start('LLM Response Generation');

        // Try streaming first
        let parsed: GhostResponse | null = null;
        let response: any = null;

        try {
            console.log('[ResponseNode] Attempting streaming response');

            const streamingParser = new StreamingMessageParser();
            const stream = await conversationAgent.stream(payload);
            let streamStartEmitted = false;

            // Extract available emoticons for fuzzy matching
            const availableEmoticons: string[] = character_setting.available_emoticon || ['neutral'];

            for await (const chunk of stream) {
                const content = typeof chunk.content === 'string'
                    ? chunk.content
                    : JSON.stringify(chunk.content);

                const parseResult = streamingParser.onChunk(content);

                // Emit stream start only after first successful chunk parse
                if (!streamStartEmitted && parseResult) {
                    streamingEvents.emitStreamStart(characterId);
                    streamStartEmitted = true;
                }

                if (parseResult) {
                    // Emit emoticon immediately when parsed with fuzzy matching
                    if (parseResult.type === 'metadata' && parseResult.emoticon) {
                        const matchedEmoticon = findEmoticonWithFallback(
                            parseResult.emoticon,
                            availableEmoticons,
                            0.6
                        );
                        streamingEvents.emit('emoticon-parsed', { characterId, emoticon: matchedEmoticon });
                    }

                    // Emit message chunks
                    if (parseResult.type === 'message_chunk' && parseResult.messageChunk) {
                        streamingEvents.emitChunk(characterId, parseResult.messageChunk);
                    }
                }
            }

            parsed = streamingParser.finalize();
            streamingEvents.emitStreamComplete(characterId);
            console.log('[ResponseNode] Streaming response completed successfully');

        } catch (streamError) {
            console.warn('[ResponseNode] Streaming failed, falling back to invoke:', streamError);
            streamingEvents.emitStreamError(characterId, streamError as Error);

            // Fallback to traditional invoke
            response = await conversationAgent.invoke(payload);
            parsed = aiResponseParser.parseGhostResponse(response);
            console.log('[ResponseNode] Fallback invoke completed');
        }

        PerformanceMonitor.end('LLM Response Generation');
        chat_history.addMessage(newMessage);
        try {
            console.log('response', parsed)

            // Use Relationship Entity with Value Objects
            const updatedAffection = relationship.getAffection().add(parsed.add_affection);
            const currentAttitude = getCurrentAttitude(characterId, updatedAffection);
            const updatedRelationship = relationship.update(parsed.add_affection, currentAttitude);
            const receivedAt = new Date();
            const characterMessage = new AkagakuCharacterMessage({
                content: parsed,
                createdAt: receivedAt
            })
            chat_history.addMessage(characterMessage);
            return {
                llm_response: response,
                chat_history: chat_history,
                invocation_result: { success: true, trial_count: currentTrialCount },
                update_payload: {
                    relationship: updatedRelationship.toRaw(),
                    history: chat_history
                },
                final_response: parsed
            };

        } catch (e) {
            if (e instanceof AIResponseParseError) {
                console.error(e)
                return {
                    llm_response: response,
                    chat_history: chat_history,
                    invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'parseError', error_message: e.message }
                }
            } else {
                return {
                    llm_response: response,
                    chat_history: chat_history,
                    invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'unknownError', error_message: e.message }
                }
            }
        }
    }
});