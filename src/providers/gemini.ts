/**
 * CognitionWeb — Google Gemini Provider
 *
 * LLM provider implementation using Google's Generative AI SDK.
 * Default provider — cheapest option with vision + function calling.
 * Model: gemini-2.0-flash
 */

import {
  GoogleGenerativeAI,
  Content,
  Part,
  FunctionDeclarationSchemaType,
  Tool as GeminiTool,
  FunctionDeclaration,
} from '@google/generative-ai';
import { LLMProvider, ChatMessage, LLMResponse, ToolCall } from './base';
import { ToolDefinition } from '../types';
import logger from '../logger';

/**
 * Maps our simple type strings to Gemini's FunctionDeclarationSchemaType.
 */
function mapSchemaType(type: string): FunctionDeclarationSchemaType {
  switch (type) {
    case 'string':
      return FunctionDeclarationSchemaType.STRING;
    case 'number':
      return FunctionDeclarationSchemaType.NUMBER;
    case 'boolean':
      return FunctionDeclarationSchemaType.BOOLEAN;
    case 'object':
      return FunctionDeclarationSchemaType.OBJECT;
    case 'array':
      return FunctionDeclarationSchemaType.ARRAY;
    default:
      return FunctionDeclarationSchemaType.STRING;
  }
}

/**
 * Convert our tool definitions to Gemini's function declaration format.
 */
function convertToGeminiTools(tools: ToolDefinition[]): GeminiTool[] {
  const functionDeclarations: FunctionDeclaration[] = tools.map((tool) => {
    const properties: Record<string, { type: FunctionDeclarationSchemaType; description: string; enum?: string[] }> = {};

    for (const [key, param] of Object.entries(tool.parameters.properties)) {
      properties[key] = {
        type: mapSchemaType(param.type),
        description: param.description,
        ...(param.enum ? { enum: param.enum } : {}),
      };
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: FunctionDeclarationSchemaType.OBJECT,
        properties,
        required: tool.parameters.required,
      },
    };
  });

  return [{ functionDeclarations }];
}

/**
 * Convert our chat messages to Gemini's Content format.
 * Gemini uses a different message structure than OpenAI.
 */
function convertToGeminiMessages(messages: ChatMessage[]): { systemInstruction: string; contents: Content[] } {
  let systemInstruction = '';
  const contents: Content[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemInstruction += msg.content + '\n';
      continue;
    }

    if (msg.role === 'user') {
      const parts: Part[] = [{ text: msg.content }];

      // Add image if present (vision support)
      if (msg.image) {
        parts.push({
          inlineData: {
            mimeType: msg.image.mimeType,
            data: msg.image.base64,
          },
        });
      }

      contents.push({ role: 'user', parts });
    } else if (msg.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: msg.content }],
      });
    } else if (msg.role === 'tool') {
      // Gemini expects function responses as a specific format
      contents.push({
        role: 'function',
        parts: [
          {
            functionResponse: {
              name: msg.toolName || 'unknown',
              response: { result: msg.content },
            },
          },
        ],
      });
    }
  }

  return { systemInstruction, contents };
}

export class GeminiProvider implements LLMProvider {
  readonly name = 'gemini';
  readonly supportsVision = true;
  private client: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName: string = 'gemini-2.0-flash') {
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    logger.info(`Gemini provider initialized (model: ${modelName})`, { tool: 'GeminiProvider' });
  }

  async chat(messages: ChatMessage[], tools: ToolDefinition[]): Promise<LLMResponse> {
    try {
      const geminiTools = convertToGeminiTools(tools);
      const { systemInstruction, contents } = convertToGeminiMessages(messages);

      const model = this.client.getGenerativeModel({
        model: this.modelName,
        systemInstruction,
        tools: geminiTools,
      });

      logger.debug('Sending request to Gemini', {
        tool: 'GeminiProvider',
        messageCount: contents.length,
        toolCount: tools.length,
      });

      const result = await model.generateContent({ contents });
      const response = result.response;
      const candidate = response.candidates?.[0];

      if (!candidate) {
        return { content: 'No response from Gemini', toolCalls: [], done: true };
      }

      // Check for function calls
      const toolCalls: ToolCall[] = [];
      let textContent = '';

      for (const part of candidate.content.parts) {
        if (part.functionCall) {
          toolCalls.push({
            id: `gemini-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            name: part.functionCall.name,
            arguments: (part.functionCall.args as Record<string, unknown>) || {},
          });
        }
        if (part.text) {
          textContent += part.text;
        }
      }

      const done = toolCalls.length === 0 && textContent.length > 0;

      logger.debug(`Gemini response: ${toolCalls.length} tool calls, text: ${textContent.substring(0, 100)}`, {
        tool: 'GeminiProvider',
      });

      return {
        content: textContent || null,
        toolCalls,
        done,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Gemini API error: ${errorMsg}`, { tool: 'GeminiProvider' });
      throw new Error(`Gemini API call failed: ${errorMsg}`);
    }
  }
}
