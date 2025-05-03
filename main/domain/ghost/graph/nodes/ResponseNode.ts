import { AIMessage } from "@langchain/core/messages";

import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { CharacterSettingLoader } from "main/infrastructure/character/CharacterRepository";
import { AIResponseParseError } from "main/infrastructure/message/MessageParser";
const getCurrentTimestamp = (sentAt: Date) => {
    return formatDatetime(sentAt);
}

const getCurrentAttitude = (characterName: string, affection: number) => {
    return CharacterSettingLoader.calcAttitude(characterName, affection);
}

const updateAffection = (affection: number, add_affection: number) => {
    return Math.min(Math.max(affection + add_affection, 0), 100);
}

const convertContextInputs = (fieldName: string, input: any) => {
    return `${fieldName} = ${JSON.stringify(input)}`
}

export const ResponseNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { input, character_setting, user_setting, llmProperties, conversationAgent, aiResponseParser, invocation_result, chat_history } = state;
        const currentTrialCount = invocation_result?.trial_count ? invocation_result.trial_count + 1 : 1;
        const characterId = character_setting.character_id;

        if (!conversationAgent) {
            return {
                invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'apiKeyNotDefined', error_message: 'API key is not defined' }
            }
        }

        const sentAt = new Date();
        const sentAtString = getCurrentTimestamp(sentAt);
        let relationship = getCharacterRelationships(characterId)
        let newMessage: { timestamp: string, message: BaseMessage } | null = null
        let content = `${sentAtString}| user | "${input.input}" \n **PLEASE NOTE : AND, NOBODY WANTS TO KNOW YOUR REASONING OR EXPLANATION. DON'T MAKE PLAIN TEXT RESPONSE. YOU MUST MAKE JSON FORMAT RESPONSE.**`
        if (state.llmProperties.llmService === 'anthropic') {
            if (state.input.isSystemMessage) {
                content = `
                ${sentAtString}| ${input.input}
And, NOBODY WANTS TO KNOW YOUR REASONING OR EXPLANATION. DON'T MAKE PLAIN TEXT RESPONSE. YOU MUST MAKE JSON FORMAT RESPONSE.
                `
            }
            newMessage = { timestamp: sentAtString, message: new HumanMessage({ name: input.isSystemMessage ? 'system' : 'user', content: content }) };
        } else {
            newMessage = { timestamp: sentAtString, message: input.isSystemMessage ? new SystemMessage(content) : new HumanMessage(content) };
        }
        let chatHistory: BaseMessage[] = chat_history.getMessages().map(({ message }) => (message));
        if (llmProperties.llmService === 'anthropic') {
            chatHistory = chatHistory.filter((message) => message.getType() !== 'system');
        }

        const payload = {
            input: newMessage.message,
            character_setting: convertContextInputs('character_setting', character_setting),
            user_setting: convertContextInputs('user_setting', user_setting),
            chat_history: convertContextInputs('chat_history', chatHistory),
            available_emoticon: convertContextInputs('available_emoticon', character_setting.available_emoticon || '["neutral"]'),
            relationship: convertContextInputs('relationship', relationship),
            tool_call_result: convertContextInputs('tool_call_result', state.tool_call_result)
        }
        const response = await conversationAgent.invoke(payload);
        chat_history.addMessage(newMessage);
        try {
            const parsed = aiResponseParser.parseGhostResponse(response);
            console.log('response', response)

            const updated_affection = updateAffection(relationship.affection_to_user, parsed.add_affection);
            const currentAttitude = getCurrentAttitude(characterId, updated_affection);
            relationship = {
                character: characterId,
                affection_to_user: updated_affection,
                attitude_to_user: currentAttitude
            }
            const receivedAt = new Date();
            const receivedAtString = formatDatetime(receivedAt);
            chat_history.addMessage({ message: new AIMessage(JSON.stringify(parsed)), timestamp: receivedAtString });
            return {
                llm_response: response,
                chat_history: chat_history,
                invocation_result: { success: true, trial_count: currentTrialCount },
                update_payload: {
                    relationship: relationship,
                    history: chat_history
                },
                final_response: parsed
            }
        } catch (e) {
            if (e instanceof AIResponseParseError) {
                console.error(e)
                return {
                    llm_response: response,
                    chat_history: chat_history,
                    invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'parseError', error_message: e.message}
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