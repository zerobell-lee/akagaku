import { AIMessage } from "@langchain/core/messages";

import { BaseMessage, HumanMessage, isSystemMessage, SystemMessage } from "@langchain/core/messages";
import { getChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { getCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { GhostState, InvocationErrorType } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { CharacterSettingLoader } from "main/infrastructure/character/CharacterRepository";

const getCurrentTimestamp = (sentAt: Date) => {
    return formatDatetime(sentAt);
}

const getCurrentAttitude = (characterName: string, affection: number) => {
    return CharacterSettingLoader.calcAttitude(characterName, affection);
}

const updateAffection = (affection: number, add_affection: number) => {
    return Math.min(Math.max(affection + add_affection, 0), 100);
}

export const ResponseNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        console.log('Here is response node', state)
        const { input, character_setting, user_setting, llmProperties, executor, aiResponseParser, invocation_result, invocation_retry_policy } = state;
        const currentTrialCount = invocation_result?.trial_count ? invocation_result.trial_count + 1 : 1;
        const characterId = character_setting.character_id;

        if (!executor) {
            return {
                invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'apiKeyNotDefined', error_message: 'API key is not defined' }
            }
        }

        const sentAt = new Date();
        const sentAtString = getCurrentTimestamp(sentAt);
        let relationship = getCharacterRelationships(characterId)
        const history = await getChatHistory(characterId);
        let newMessage: { timestamp: string, message: BaseMessage } | null = null
        let content = `${sentAtString}| ${input.input}`
        if (state.llmProperties.llmService === 'anthropic') {
            if (state.input.isSystemMessage) {
                content = `
                ${sentAtString}| ${input.input}
                And, don't leave any comment in your response, so that the agent can parse it.
                `
            }
            newMessage = { timestamp: sentAtString, message: new HumanMessage({ name: isSystemMessage ? 'system' : 'user', content: content }) };
        } else {
            newMessage = { timestamp: sentAtString, message: isSystemMessage ? new SystemMessage(content) : new HumanMessage(content) };
        }
        let chatHistory: BaseMessage[] = history.getMessages().map(({ message }) => (message));
        if (llmProperties.llmService === 'anthropic') {
            chatHistory = chatHistory.filter((message) => message.getType() !== 'system');
        }

        const payload = {
            input: newMessage.message,
            character_setting: JSON.stringify(character_setting),
            user_setting: JSON.stringify(user_setting),
            chat_history: chatHistory,
            available_emoticon: character_setting.available_emoticon || '["neutral"]',
            relationship: JSON.stringify(relationship),
        }
        let errorType: InvocationErrorType | null = null;
        let errorMessage: string | null = null;
        let success = true;
        const response = await executor.invoke(payload);
        history.addMessage(newMessage);
        try {
            const parsed = aiResponseParser.parse(response);
            console.log('response', response)
            if (!parsed) {
                success = false;
                errorType = 'parseError';
                errorMessage = 'Failed to parse response';

                return {
                    llm_response: response,
                    chat_history: history,
                    invocation_result: { success: false, trial_count: currentTrialCount, error_type: errorType, error_message: errorMessage }
                };
            }
            const updated_affection = updateAffection(relationship.affection_to_user, parsed.add_affection);
            const currentAttitude = getCurrentAttitude(characterId, updated_affection);
            relationship = {
                character: characterId,
                affection_to_user: updated_affection,
                attitude_to_user: currentAttitude
            }
            const receivedAt = new Date();
            const receivedAtString = formatDatetime(receivedAt);
            history.addMessage({ message: new AIMessage(JSON.stringify(parsed)), timestamp: receivedAtString });
            return {
                llm_response: response,
                chat_history: history,
                update_payload: {
                    relationship: relationship,
                    history: history
                },
                final_response: parsed
            }
        } catch (e) {
            success = false;
            errorType = 'unknownError';
            errorMessage = 'Unknown error';
        }

        return {
            llm_response: response,
            chat_history: history,
            update_payload: {
                relationship: relationship,
                history: history
            },
            invocation_result: { success: false, trial_count: currentTrialCount, error_type: 'unknownError', error_message: 'Unknown error' }
        };
    }
});