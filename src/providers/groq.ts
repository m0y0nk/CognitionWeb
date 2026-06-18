/**
 * CognitionWeb — Groq Provider
 *
 * LLM provider implementation using the Groq SDK.
 * Fastest inference but no vision support — relies on page info
 * (DOM analysis) instead of screenshots for page understanding.
 * Model: llama-3.3-70b-versatile
 */

import Groq from 'groq-sdk';
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'groq-sdk/resources/chat/completions';
import { LLMProvider, ChatMessage, LLMResponse, ToolCall } from './base';
import { ToolDefinition } from '../types';
import logger from '../logger';

/**
 * Convert our tool definitions to Groq/OpenAI function format.
 */
function convertToGroqTools(tools: ToolDefinition[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object' as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
    },
  }));
}

/**
 * Convert our chat messages to Groq's message format.
 * Groq uses the OpenAI-compatible format.
 */
function convertToGroqMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'system') {
      return { role: 'system' as const, content: msg.content };
    }
    if (msg.role === 'user') {
      // Groq doesn't support vision — just use text content
      return { role: 'user' as const, content: msg.content };
    }
    if (msg.role === 'assistant') {
      return { role: 'assistant' as const, content: msg.content };
    }
    if (msg.role === 'tool') {
      return {
        role: 'tool' as const,
        content: msg.content,
        tool_call_id: msg.toolCallId || '',
      };
    }
    return { role: 'user' as const, content: msg.content };
  });
}

export class GroqProvider implements LLMProvider {
  readonly name = 'groq';
  readonly supportsVision = false;
  private client: Groq;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'llama-3.3-70b-versatile') {
    this.client = new Groq({ apiKey });
    this.modelName = modelName;
    logger.info(`Groq provider initialized (model: ${modelName})`, { tool: 'GroqProvider' });
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const groqTools = convertToGroqTools(tools);
      const groqMessages = convertToGroqMessages(messages);

      logger.debug('Sending request to Groq', {
        tool: 'GroqProvider',
        messageCount: groqMessages.length,
        toolCount: tools.length,
      });

      const completion = await this.client.chat.completions.create({
        model: this.modelName,
        messages: groqMessages,
        tools: groqTools,
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 4096,
      });

      const choice = completion.choices[0];
      if (!choice) {
        return { content: 'No response from Groq', toolCalls: [], done: true };
      }

      const message = choice.message;
      const toolCalls: ToolCall[] = [];

      if (message.tool_calls) {
        for (const tc of message.tool_calls) {
          let parsedArgs: Record<string, unknown> = {};
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            logger.warn(`Failed to parse tool args: ${tc.function.arguments}`, {
              tool: 'GroqProvider',
            });
          }

          toolCalls.push({
            id: tc.id,
            name: tc.function.name,
            arguments: parsedArgs,
          });
        }
      }

      const content = message.content || null;
      const done = toolCalls.length === 0 && !!content;

      logger.debug(`Groq response: ${toolCalls.length} tool calls, text: ${(content || '').substring(0, 100)}`, {
        tool: 'GroqProvider',
      });

      return { content, toolCalls, done };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Groq API error: ${errorMsg}`, { tool: 'GroqProvider' });
      throw new Error(`Groq API call failed: ${errorMsg}`);
    }
  }
}
