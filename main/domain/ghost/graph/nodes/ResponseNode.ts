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

const getCurrentTimestamp = (sentAt: Date) => {
    return formatDatetime(sentAt);
}

const getCurrentAttitude = (characterName: string, affection: Affection): Attitude => {
    const attitudeString = CharacterSettingLoader.calcAttitude(characterName, affection.getValue());
    return Attitude.create(attitudeString);
}

const convertContextInputs = (fieldName: string, input: any) => {
    return `${fieldName} = ${JSON.stringify(input)}`
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

        const payload = {
            input: newMessage.content as string,
            character_setting: convertContextInputs('character_setting', character_setting),
            user_setting: convertContextInputs('user_setting', user_setting),
            chat_history: convertContextInputs('chat_history', langchainChatHistory),
            available_emoticon: convertContextInputs('available_emoticon', character_setting.available_emoticon || '["neutral"]'),
            relationship: convertContextInputs('relationship', relationship.toRaw()),
            tool_call_result: `tool_call_result = ${toolCallFinalAnswer}`
        }
        const response = await conversationAgent.invoke(payload);
        chat_history.addMessage(newMessage);
        try {
            const parsed = aiResponseParser.parseGhostResponse(response);
            console.log('response', response)

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