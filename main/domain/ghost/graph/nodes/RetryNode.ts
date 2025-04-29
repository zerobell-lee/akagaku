import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { getCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { AIResponseParseError } from "main/infrastructure/message/MessageParser";

export const RetryNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { invocation_retry_policy, executor, aiResponseParser, llmProperties, character_setting, user_setting, chat_history, llm_response } = state;
        const { maximum_trial } = invocation_retry_policy;
        const { trial_count } = state.invocation_result;
        if (trial_count > maximum_trial) {
            return {};
        }

        const retryInput = `Agent failed to parse your response. It is usually because you didn't make JSON format response, and added absolutely useless information, such as reasoning or explanation. Nobody wants to know your reasoning or explanation. Make a response again according to system prompt. Your last response: ${JSON.stringify(llm_response.output)}`
        let retryInputMessage: BaseMessage

        if (llmProperties.llmService === 'anthropic') {
            retryInputMessage = new HumanMessage({ name: 'system', content: retryInput })
        } else {
            retryInputMessage = new SystemMessage(retryInput)
        }

        let relationship = getCharacterRelationships(character_setting.character_id)

        try {
            const response = await executor.invoke({
                input: retryInputMessage,
                character_setting: `<character_setting>${JSON.stringify(character_setting)}</character_setting>`,
                user_setting: `<user_setting>${JSON.stringify(user_setting)}</user_setting>`,
                chat_history: `<chat_history>${chat_history.getMessages().map(({ message }) => message).join('\n')}</chat_history>`,
                available_emoticon: `<available_emoticon>${character_setting.available_emoticon || '["neutral"]'}</available_emoticon>`,
                relationship: `<relationship>${JSON.stringify(relationship)}</relationship>`,
            })

            const parsed = aiResponseParser.parseGhostResponse(response);
            if (!parsed) {
                return { invocation_result: { success: false, trial_count: trial_count + 1, error_type: 'parseError', error_message: 'Failed to parse response' } };
            }
            chat_history.addMessage({ message: new AIMessage(JSON.stringify(parsed)), timestamp: formatDatetime(new Date()) })
            return { llm_response: response, final_response: parsed, invocation_result: { success: true, trial_count: trial_count }, update_payload: { relationship: relationship, history: chat_history } };
        } catch (e) {
            if (e instanceof AIResponseParseError) {
                return { invocation_result: { success: false, trial_count: trial_count + 1, error_type: 'parseError', error_message: 'Failed to parse response' } };
            }
            return { invocation_result: { success: false, trial_count: trial_count + 1, error_type: 'unknownError', error_message: 'Unknown error' } };
        }
    }
})
