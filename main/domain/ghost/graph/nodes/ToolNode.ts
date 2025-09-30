import { AIMessage } from "@langchain/core/messages";
import { GhostState } from "../states";
import { RunnableLambda } from "@langchain/core/runnables";
import { formatDatetime } from "main/infrastructure/utils/DatetimeStringUtils";
import { core_tools } from "main/domain/tools/core";
import { ToolCallDetector } from "../utils/ToolCallDetector";

export const ToolNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {

        const { toolAgent, chat_history, toolCallHistory, userInput } = state;

        console.log(toolCallHistory)
        const conversationContext = chat_history.getMessages(6).map((message) => message.toChatLog()).map(chatLog => `${formatDatetime(chatLog.createdAt)} | ${chatLog.role}: ${chatLog.content}`).join('\n')

        if (!toolAgent) {
            return { toolCallCompleted: true, toolCallHistory: [], toolCallFinalAnswer: '' };
        }

        // Fast path: Skip LLM if pattern matching says no tools needed
        const needsTools = ToolCallDetector.needsToolCall(userInput.payload);
        if (!needsTools) {
            console.log('[Performance] Fast path: No tools needed');
            return { toolCallCompleted: true, toolCallHistory: [], toolCallFinalAnswer: 'No tool calls' };
        }

        // Slow path: Use lightweight LLM for MCP and complex tool decisions
        try {
            // Minimize context sent to LLM - only send last message, not full conversation
            const result = await toolAgent.invoke({
                conversation_context: '',  // Empty - don't send conversation history
                input: userInput.payload,  // Just the user input, no timestamp formatting
                tool_history: toolCallHistory.length > 0 ? toolCallHistory.slice(-2) : []  // Only last 2 tool results
            });

            console.log('tool result', result)

            // AgentExecutor returns { output, intermediateSteps }
            const intermediateSteps = result.intermediateSteps || [];
            const output = result.output;

            console.log('intermediateSteps', intermediateSteps)
            console.log('output', output)

            // If tool was executed successfully
            if (intermediateSteps.length > 0) {
                const toolResults = intermediateSteps.map((step: any) => step.observation).join('\n');
                return {
                    toolCallCompleted: true,
                    toolCallHistory: [...toolCallHistory, ...intermediateSteps],
                    toolCallFinalAnswer: toolResults
                };
            }

            // No tools executed - check if it's because no tools were needed
            const toolCalls = (result as AIMessage)?.tool_calls || [];

            if (toolCalls.length === 0) {
                let finalAnswer = result.content || ''

                // Handle various response formats
                if (typeof finalAnswer === 'string') {
                    // Remove common explanatory text patterns
                    finalAnswer = finalAnswer
                        .replace(/^(Based on|According to|Looking at|Given that|Since|Considering).*?[,:]?\s*/i, '')
                        .replace(/^(I|The|This).*?(don't need|no need|not necessary|already|sufficient).*?\./i, 'No tool calls')
                        .trim();

                    // If it's just "No tool calls" or similar, clean it up
                    if (/^no\s+tool\s*calls?/i.test(finalAnswer)) {
                        finalAnswer = 'No tool calls';
                    }
                }

                if (finalAnswer.trim() === '' || (Array.isArray(finalAnswer) && finalAnswer.length === 0)) {
                    if (toolCallHistory.length > 0) {
                        finalAnswer = toolCallHistory[toolCallHistory.length - 1].content as string;
                    } else {
                        finalAnswer = 'No tool calls';
                    }
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

            // Format tool results for final answer
            const toolResultSummary = toolCallHistory
                .map(result => typeof result === 'string' ? result : JSON.stringify(result))
                .join('\n');

            return {
                toolCallCompleted: true,
                toolCallHistory,
                toolCallFinalAnswer: toolResultSummary
            };
        } catch (e) {
            console.log('tool node error', e)
            return { toolCallCompleted: true, toolCallHistory: null, toolCallFinalAnswer: '' };
        }
    }
}); 