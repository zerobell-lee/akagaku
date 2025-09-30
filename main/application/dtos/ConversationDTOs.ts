import { GhostResponse } from "@shared/types";

/**
 * Input DTO for sending a message
 */
export interface SendMessageInput {
  readonly message: string;
  readonly isSystemMessage: boolean;
}

/**
 * Output DTO for conversation response
 */
export interface ConversationOutput {
  readonly response: GhostResponse;
  readonly success: boolean;
  readonly errorType?: string;
  readonly errorMessage?: string;
}

/**
 * Input DTO for greeting user
 */
export interface GreetUserInput {
  readonly isFirstTime: boolean;
}

/**
 * Input DTO for farewell
 */
export interface FarewellInput {
  readonly reason?: string;
}

/**
 * Input DTO for chit-chat
 */
export interface ChitChatInput {
  readonly context?: string;
}