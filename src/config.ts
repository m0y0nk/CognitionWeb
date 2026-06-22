/**
 * CognitionWeb — Configuration Loader
 *
 * Loads environment variables from .env file, validates required keys
 * based on the selected LLM provider, and exports a typed config object.
 */

import dotenv from 'dotenv';
import path from 'path';
import { AgentConfig, LLMProviderName } from './types';

// Load .env file from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/** Map of provider names to their required environment variable */
const PROVIDER_KEY_MAP: Record<LLMProviderName, string> = {
  gemini: 'GEMINI_API_KEY',
  groq: 'GROQ_API_KEY',
  openai: 'OPENAI_API_KEY',
};

/**
 * Loads and validates the agent configuration from environment variables.
 * Throws an error if required values are missing.
 */
export function loadConfig(): AgentConfig {
  const provider = (process.env.LLM_PROVIDER || 'gemini') as LLMProviderName;

  // Validate provider name
  if (!['gemini', 'groq', 'openai'].includes(provider)) {
    throw new Error(
      `Invalid LLM_PROVIDER "${provider}". Must be one of: gemini, groq, openai`
    );
  }

  // Validate API key for selected provider
  const keyEnvVar = PROVIDER_KEY_MAP[provider];
  const apiKey = process.env[keyEnvVar];

  if (!apiKey || apiKey === `your_${provider}_api_key_here`) {
    throw new Error(
      `Missing API key for provider "${provider}". ` +
      `Please set ${keyEnvVar} in your .env file.\n` +
      `  1. Copy .env.example to .env:  cp .env.example .env\n` +
      `  2. Set your ${keyEnvVar} in .env`
    );
  }

  // Parse browser type
  const browserType = (process.env.BROWSER_TYPE || 'chromium') as AgentConfig['browserType'];
  if (!['chromium', 'firefox', 'webkit'].includes(browserType)) {
    throw new Error(
      `Invalid BROWSER_TYPE "${browserType}". Must be one of: chromium, firefox, webkit`
    );
  }

  return {
    llmProvider: provider,
    apiKey,
    headless: process.env.HEADLESS === 'true',
    browserType,
    targetUrl: process.env.TARGET_URL || 'https://ui.shadcn.com/docs/forms/react-hook-form',
    maxIterations: parseInt(process.env.MAX_ITERATIONS || '25', 10),
    rateLimitDelayMs: parseInt(process.env.RATE_LIMIT_DELAY_MS || '4200', 10),
  };
}
