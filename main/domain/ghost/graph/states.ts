import { BaseMessage } from "@langchain/core/messages";
import { GhostResponse } from "@shared/types";
import { Tool, DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { ChainValues } from "@langchain/core/dist/utils/types";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { Relationship } from "main/infrastructure/user/RelationshipRepository";
export interface UserInput {
  input: string;
  isSystemMessage: boolean;
}

export interface llmProperties {
    llmService: string;
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

export interface ToolCallResult {
    tool_call_chain: ToolCall[];
}

export interface GhostState {
  input: UserInput;
  chat_history: AkagakuChatHistory;
  llmProperties: llmProperties;
  executor: Runnable<ChainValues, ChainValues, RunnableConfig<Record<string, any>>> | null;
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
}
