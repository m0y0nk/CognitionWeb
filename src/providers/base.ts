/**
 * CognitionWeb — LLM Provider Base Interface
 *
 * Defines the abstract interface that all LLM providers must implement.
 * This enables swapping between Gemini, Groq, and OpenAI without
 * changing any agent code.
 */

import { ToolDefinition } from '../types';

// ============================================
// Message Types
// ============================================

/** Role of a message in the conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A message in the conversation, potentially with image data */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  /** Tool call ID — required for tool result messages */
  toolCallId?: string;
  /** Tool name — for tool result messages */
  toolName?: string;
  /** Image data for vision-capable models */
  image?: {
    base64: string;
    mimeType: string;
  };
}

// ============================================
// Response Types
// ============================================

/** A tool call requested by the LLM */
export interface ToolCall {
  /** Unique ID for this tool call (used to match results) */
  id: string;
  /** Name of the tool to invoke */
  name: string;
  /** Parsed arguments for the tool */
  arguments: Record<string, unknown>;
}

/** Unified response from any LLM provider */
export interface LLMResponse {
  /** Text content of the response (if any) */
  content: string | null;
  /** Tool calls the model wants to make */
  toolCalls: ToolCall[];
  /** True if the model has finished (final answer, no more tool calls) */
  done: boolean;
}

// ============================================
// Provider Interface
// ============================================

/**
 * Abstract LLM Provider interface.
 *
 * All providers (Gemini, Groq, OpenAI) implement this interface,
 * enabling the agent to work with any provider interchangeably.
 */
export interface LLMProvider {
  /** Provider name for logging */
  readonly name: string;

  /** Whether this provider supports vision (screenshot analysis) */
  readonly supportsVision: boolean;

  /**
   * Send a chat completion request with tool definitions.
   *
   * @param messages - Conversation history
   * @param tools - Available tool definitions for function calling
   * @returns Unified LLM response with optional tool calls
   */
  chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse>;
}
