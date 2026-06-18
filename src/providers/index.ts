/**
 * CognitionWeb — Provider Factory
 *
 * Factory function that creates the appropriate LLM provider
 * based on the configuration. Maps LLM_PROVIDER env var to
 * the correct provider class.
 */

import { LLMProvider } from './base';
import { GeminiProvider } from './gemini';
import { GroqProvider } from './groq';
import { OpenAIProvider } from './openai';
import { AgentConfig, LLMProviderName } from '../types';
import logger from '../logger';

// Re-export types for convenience
export type { LLMProvider, ChatMessage, LLMResponse, ToolCall } from './base';

/**
 * Create an LLM provider instance based on the agent configuration.
 *
 * @param config - Agent configuration with provider name and API key
 * @returns An LLMProvider instance ready to use
 * @throws Error if the provider name is not recognized
 */
export function createProvider(config: AgentConfig): LLMProvider {
  const providerName = config.llmProvider;
  const apiKey = config.apiKey;

  logger.info(`Creating LLM provider: ${providerName}`, { tool: 'ProviderFactory' });

  switch (providerName) {
    case 'gemini':
      return new GeminiProvider(apiKey);
    case 'groq':
      return new GroqProvider(apiKey);
    case 'openai':
      return new OpenAIProvider(apiKey);
    default:
      throw new Error(
        `Unknown LLM provider: "${providerName}". ` +
        `Supported providers: gemini, groq, openai`
      );
  }
}

/**
 * Get a human-readable description of the provider's capabilities.
 */
export function getProviderInfo(name: LLMProviderName): {
  model: string;
  supportsVision: boolean;
  description: string;
} {
  switch (name) {
    case 'gemini':
      return {
        model: 'gemini-2.0-flash',
        supportsVision: true,
        description: 'Google Gemini Flash — Cheapest, with vision + function calling',
      };
    case 'groq':
      return {
        model: 'llama-3.3-70b-versatile',
        supportsVision: false,
        description: 'Groq (Llama 3.3) — Fastest inference, no vision (uses DOM analysis)',
      };
    case 'openai':
      return {
        model: 'gpt-4o-mini',
        supportsVision: true,
        description: 'OpenAI GPT-4o-mini — Great balance of cost and capability',
      };
    default:
      return {
        model: 'unknown',
        supportsVision: false,
        description: 'Unknown provider',
      };
  }
}
