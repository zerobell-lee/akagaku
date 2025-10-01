import { GhostResponse, LLMService } from "@shared/types";
import { Tool, DynamicStructuredTool, DynamicTool } from "@langchain/core/tools";
import { Runnable, RunnableConfig } from "@langchain/core/runnables";
import { CharacterSetting } from "main/infrastructure/character/CharacterRepository";
import { AIResponseParser } from "main/infrastructure/message/MessageParser";
import { AkagakuChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";
import { Relationship } from "main/infrastructure/user/RelationshipRepository";
import { z } from "zod";
import { AkagakuMessageConverter } from "main/domain/message/AkagakuMessage";
import { BaseMessage } from "@langchain/core/messages";
export interface UserInput {
  payload: string;
  isSystemMessage: boolean;
}

export interface llmProperties {
    llmService: LLMService;
    modelName: string;
    apiKey: string;
    temperature: number;
    baseURL?: string; // Custom endpoint for OpenRouter, local LLMs, proxies, etc.
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

export interface GhostState {
  userInput: UserInput;
  skipToolCall: boolean;
  toolCallCompleted: boolean;
  toolCallHistory: BaseMessage[];
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
  toolCallFinalAnswer: string;
  is_user_update_needed: boolean;
  toolAgent: Runnable | null;
  conversationAgent: Runnable | null;
  messageConverter: AkagakuMessageConverter;
  currentSkinDescription: string;  // Current skin description for AI context
}
