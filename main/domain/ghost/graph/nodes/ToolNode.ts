import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GhostResponse } from "@shared/types";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";

export const ToolNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        
        const { aiResponseParser, toolAgent, chat_history } = state;

        console.log('chat_history', chat_history.getMessages())

        // Start of Selection
        const conversationContext = chat_history.getMessages().map((message) => message.toChatLog()).map(chatLog => `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`).join('\n')

        try {
            const result = await toolAgent.invoke({
                conversation_context: `conversation_context = ${JSON.stringify(conversationContext)}`,
                input: state.userInput.payload
            });
    
            const toolCallResult = aiResponseParser.parseToolResponse(result);        
    
            return { tool_call_result: toolCallResult };
        } catch (e) {
            console.log('tool node error', e)
            return { tool_call_result: { tool_call_chain: [], final_answer: '' } };
        }
    }
}); 