import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { getCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";

export const RetryNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { invocation_retry_policy, executor, aiResponseParser, llmProperties, character_setting, user_setting, chat_history, llm_response } = state;
        const { maximum_trial } = invocation_retry_policy;
        const { trial_count } = state.invocation_result;
        if (trial_count > maximum_trial) {
            return {};
        }

        const retryInput = `Agent failed to parse your response. Make a response again according to system prompt. Your last response: ${JSON.stringify(llm_response)}`
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
                character_setting: JSON.stringify(character_setting),
                user_setting: JSON.stringify(user_setting),
                chat_history: chat_history.getMessages(),
                available_emoticon: character_setting.available_emoticon || '["neutral"]',
                relationship: JSON.stringify(relationship),
            })

            const parsed = aiResponseParser.parse(response);
            if (!parsed) {
                return { invocation_result: { success: false, trial_count: trial_count + 1, error_type: 'parseError', error_message: 'Failed to parse response' } };
            }
            return { llm_response: response, final_response: parsed, invocation_result: { success: true, trial_count: trial_count }, chat_history: chat_history.addMessage({ message: new AIMessage(JSON.stringify(parsed)), timestamp: formatDatetime(new Date()) }) as AkagakuChatHistory };
        } catch (e) {
            return { invocation_result: { success: false, trial_count: trial_count + 1, error_type: 'unknownError', error_message: 'Unknown error' } };
        }
    }
})
