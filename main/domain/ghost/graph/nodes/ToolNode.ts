import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { GhostResponse } from "@shared/types";

export const ToolNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        
        const aiMessageParser = state.aiResponseParser;
        const toolAgent = state.toolAgent;

        const conversations = []

        for (const message of state.chat_history.getMessages()) {
            let tmpMessageContent = message.message.content as string
            let role = 'User'
            if (message.message instanceof AIMessage) {
                const parsed = JSON.parse(tmpMessageContent) as GhostResponse
                tmpMessageContent = parsed.message
                role = 'Character'
            }
            if (message.message instanceof HumanMessage) {
                tmpMessageContent = tmpMessageContent.replace(/^\d+\|/, '')
            }
            if (message.message instanceof SystemMessage) {
                role = 'System'
            }

            const messageContent = `[${message.timestamp}] ${role}: ${tmpMessageContent}`
            conversations.push(messageContent)
        }

        // Start of Selection
        const conversationContext = state.chat_history.getMessages().slice(-6).map(({message}) => `${message instanceof HumanMessage ? 'User' : 'Character'}: ${message.content}`).join("\n");

        try {
            const result = await toolAgent.invoke({
                conversation_context: `conversation_context = ${JSON.stringify(conversationContext)}`,
                input: state.input.input
            });
    
            const toolCallResult = aiMessageParser.parseToolResponse(result);        
    
            return { tool_call_result: toolCallResult };
        } catch (e) {
            console.log('tool node error', e)
            return { tool_call_result: { tool_call_chain: [], final_answer: '' } };
        }
        
}
}); 