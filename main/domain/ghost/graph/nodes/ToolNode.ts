import { AIMessage } from "@langchain/core/messages";
import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { core_tools } from "main/domain/tools/core";

export const ToolNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        
        const { toolAgent, chat_history, toolCallHistory } = state;

        console.log(toolCallHistory)
        const conversationContext = chat_history.getMessages(6).map((message) => message.toChatLog()).map(chatLog => `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`).join('\n')

        if (!toolAgent) {
            return { toolCallCompleted: true, toolCallHistory: [], toolCallFinalAnswer: '' };
        }

        try {
            const result = await toolAgent.invoke({
                conversation_context: `conversation_context = ${JSON.stringify(conversationContext)}`,
                input: `${formatDatetime(new Date())}| ${state.userInput.payload}`,
                tool_history: toolCallHistory
            });

            console.log('tool result', result)

            toolCallHistory.push(result)
            const toolCalls = (result as AIMessage).tool_calls
            console.log('tool result', result)

            if (toolCalls.length === 0) {
                let finalAnswer = result.content
                if (finalAnswer.trim() === '' || (Array.isArray(finalAnswer) && finalAnswer.length === 0)) {
                    finalAnswer = toolCallHistory[toolCallHistory.length - 1].content as string
                }
                return { toolCallCompleted: true, toolCallHistory: null, toolCallFinalAnswer: finalAnswer };
            }
            
            for (const toolCall of toolCalls) {
                const tool = core_tools.find((tool) => tool.name === toolCall.name)
                if (tool) {
                    const toolResult = await tool.invoke(toolCall)
                    toolCallHistory.push(toolResult)
                }
            }
    
            return { toolCallHistory };
        } catch (e) {
            console.log('tool node error', e)
            return { toolCallCompleted: true, toolCallHistory: null, toolCallFinalAnswer: '' };
        }
    }
}); 