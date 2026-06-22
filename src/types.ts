/**
 * CognitionWeb — Type Definitions
 *
 * Central type definitions for the automation agent.
 * All interfaces and types used across modules are defined here.
 */

import { Page } from 'playwright';

// ============================================
// Tool System Types
// ============================================

/** Result returned by every tool after execution */
export interface ToolResult {
  /** Whether the tool executed successfully */
  success: boolean;
  /** Human-readable description of what happened */
  message: string;
  /** Optional structured data from the tool */
  data?: Record<string, unknown>;
  /** Optional base64-encoded screenshot */
  screenshot?: string;
  /** Error message if the tool failed */
  error?: string;
}

/** Definition of a tool's parameter schema (JSON Schema subset) */
export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
}

/** Complete definition of a tool for LLM function calling */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
}

/** Interface every tool module must implement */
export interface Tool {
  /** Unique tool name (used in function calling) */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** JSON Schema for the tool's parameters */
  parameters: ToolDefinition['parameters'];
  /** Execute the tool with given arguments */
  execute(args: Record<string, unknown>, page: Page | null): Promise<ToolResult>;
}

// ============================================
// LLM Provider Types
// ============================================

/** Supported LLM provider names */
export type LLMProviderName = 'gemini' | 'groq' | 'openai';

/** Role of a message in the conversation */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** A single message in the conversation history */
export interface Message {
  role: MessageRole;
  content: string;
  /** Tool call ID (for tool result messages) */
  toolCallId?: string;
  /** Tool name (for tool result messages) */
  toolName?: string;
  /** Image data for vision-capable models */
  imageData?: {
    base64: string;
    mimeType: string;
  };
}

/** A tool call requested by the LLM */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Response from the LLM provider */
export interface LLMResponse {
  /** Text content of the response (if any) */
  content: string | null;
  /** Tool calls requested by the model (if any) */
  toolCalls: LLMToolCall[];
  /** Whether the model is done (no more tool calls, final answer) */
  done: boolean;
}

// ============================================
// Agent Types
// ============================================

/** Agent configuration loaded from environment */
export interface AgentConfig {
  llmProvider: LLMProviderName;
  apiKey: string;
  headless: boolean;
  browserType: 'chromium' | 'firefox' | 'webkit';
  targetUrl: string;
  maxIterations: number;
  rateLimitDelayMs: number;
}

/** Record of a single agent step (for logging) */
export interface AgentStep {
  iteration: number;
  timestamp: string;
  action: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  result?: ToolResult;
  llmResponse?: string;
}

// ============================================
// Page Analysis Types
// ============================================

/** Information about a form field on the page */
export interface FormFieldInfo {
  /** Label text associated with the field */
  label: string;
  /** HTML input type (text, email, textarea, etc.) */
  type: string;
  /** Current value of the field */
  value: string;
  /** Placeholder text */
  placeholder: string;
  /** CSS selector to target this field */
  selector: string;
  /** Bounding box coordinates */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

/** Information about a clickable element on the page */
export interface ClickableElementInfo {
  /** Text content of the element */
  text: string;
  /** Tag name (button, a, etc.) */
  tagName: string;
  /** Element's role attribute */
  role: string;
  /** CSS selector */
  selector: string;
  /** Bounding box coordinates */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
}

/** Structured information about the current page state */
export interface PageInfo {
  /** Page title */
  title: string;
  /** Current URL */
  url: string;
  /** Form fields found on the page */
  formFields: FormFieldInfo[];
  /** Clickable elements found on the page */
  clickableElements: ClickableElementInfo[];
  /** Summary of visible text content */
  textSummary: string;
}
