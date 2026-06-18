/**
 * CognitionWeb — OpenAI Provider
 *
 * LLM provider implementation using the OpenAI SDK.
 * Supports vision (screenshot analysis) and function calling.
 * Model: gpt-4o-mini (cheaper than gpt-4o)
 */

import OpenAI from 'openai';
import {
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionContentPart,
} from 'openai/resources/chat/completions';
import { LLMProvider, ChatMessage, LLMResponse, ToolCall } from './base';
import { ToolDefinition } from '../types';
import logger from '../logger';

/**
 * Convert our tool definitions to OpenAI function calling format.
 */
function convertToOpenAITools(tools: ToolDefinition[]): ChatCompletionTool[] {
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
 * Convert our chat messages to OpenAI's message format.
 * Handles multimodal messages (text + image) for vision.
 */
function convertToOpenAIMessages(messages: ChatMessage[]): ChatCompletionMessageParam[] {
  return messages.map((msg) => {
    if (msg.role === 'system') {
      return { role: 'system' as const, content: msg.content };
    }

    if (msg.role === 'user') {
      // If there's an image, use multimodal content
      if (msg.image) {
        const parts: ChatCompletionContentPart[] = [
          { type: 'text', text: msg.content },
          {
            type: 'image_url',
            image_url: {
              url: `data:${msg.image.mimeType};base64,${msg.image.base64}`,
              detail: 'low', // Use 'low' to save tokens
            },
          },
        ];
        return { role: 'user' as const, content: parts };
      }
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

export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai';
  readonly supportsVision = true;
  private client: OpenAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.modelName = modelName;
    logger.info(`OpenAI provider initialized (model: ${modelName})`, { tool: 'OpenAIProvider' });
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const openaiTools = convertToOpenAITools(tools);
      const openaiMessages = convertToOpenAIMessages(messages);

      logger.debug('Sending request to OpenAI', {
        tool: 'OpenAIProvider',
        messageCount: openaiMessages.length,
        toolCount: tools.length,
      });

      const completion = await this.client.chat.completions.create({
        model: this.modelName,
        messages: openaiMessages,
        tools: openaiTools,
        tool_choice: 'auto',
        temperature: 0.1,
        max_tokens: 4096,
      });

      const choice = completion.choices[0];
      if (!choice) {
        return { content: 'No response from OpenAI', toolCalls: [], done: true };
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
              tool: 'OpenAIProvider',
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
      const done = choice.finish_reason === 'stop' && toolCalls.length === 0;

      logger.debug(`OpenAI response: ${toolCalls.length} tool calls, text: ${(content || '').substring(0, 100)}`, {
        tool: 'OpenAIProvider',
      });

      return { content, toolCalls, done };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`OpenAI API error: ${errorMsg}`, { tool: 'OpenAIProvider' });
      throw new Error(`OpenAI API call failed: ${errorMsg}`);
    }
  }
}
