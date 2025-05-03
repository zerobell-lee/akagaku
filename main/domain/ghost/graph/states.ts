import { GhostResponse, LLMService } from "@shared/types";
import { Tool, DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { Relationship } from "main/infrastructure/user/RelationshipRepository";
import { z } from "zod";
import { AkagakuMessageConverter } from "main/domain/message/AkagakuMessage";
export interface UserInput {
  payload: string;
  isSystemMessage: boolean;
}

export interface llmProperties {
    llmService: LLMService;
    modelName: string;
    apiKey: string;
    temperature: number;
}

export interface invocationResult {
    success: boolean;
    trial_count: number;
    error_type?: InvocationErrorType;
    error_message?: string;
}

export interface invocationRetryPolicy {
    maximum_trial: number;
}

export type InvocationErrorType = 'parseError' | 'apiKeyNotDefined' | 'unknownError'

export interface UpdatePayload {
    relationship: Relationship;
    history: AkagakuChatHistory;
}

export interface ToolCall {
    name: string;
    args: Record<string, any>;
    result: string;
}

export const ToolCallResultFormatter = z.object({
    tool_call_chain: z.array(z.object({
        name: z.string().describe("name of tool"),
        args: z.record(z.string(), z.any()).describe("arguments for tool"),
        result: z.string().describe("result of tool. It is nullable if tool call is uncompleted")
    })).describe("array of tool call chain. It is empty when no tool call is made")
})

export interface ToolCallResult {
    tool_call_chain: ToolCall[];
}

export interface GhostState {
  userInput: UserInput;
  skipToolCall: boolean;
  chat_history: AkagakuChatHistory;
  llmProperties: llmProperties;
  character_setting: CharacterSetting;
  user_setting: any;
  llm_response?: any;
  final_response?: GhostResponse;
  aiResponseParser: AIResponseParser | null;
  invocation_result: invocationResult | null;
  invocation_retry_policy: invocationRetryPolicy;
  update_payload?: UpdatePayload;
  tools: (DynamicStructuredTool | DynamicTool | Tool)[];
  promptForCharacter: string;
  promptForTool: string;
  tool_call_result: ToolCallResult;
  is_user_update_needed: boolean;
  toolAgent: Runnable | null;
  conversationAgent: Runnable | null;
  messageConverter: AkagakuMessageConverter;
}
