import { BaseMessage } from "@langchain/core/messages";

/**
 * LLM Service Port Interface
 *
 * Application layer interface for LLM operations.
 * Infrastructure layer (LangChain) implements this interface.
 */
export interface ILLMService {
  /**
   * Invoke LLM with payload
   */
  invoke(payload: Record<string, any>): Promise<any>;
}

/**
 * Message Parser Port Interface
 *
 * Application layer interface for parsing LLM responses.
 */
export interface IMessageParser {
  /**
   * Parse LLM response to structured format
   */
  parseGhostResponse(response: any): any;
}

/**
 * Message Converter Port Interface
 *
 * Application layer interface for converting messages between formats.
 */
export interface IMessageConverter {
  /**
   * Convert domain message to LangChain format
   */
  convertToLangChainMessage(message: any): BaseMessage;
}