/**
 * CognitionWeb — Core Agent
 *
 * The brain of the automation system. Implements a ReAct (Reasoning + Action)
 * loop that uses an LLM to observe the page, decide on actions, execute them
 * via tools, and iterate until the task is complete.
 *
 * Architecture:
 *   1. Observe: Screenshot + page info → build context
 *   2. Reason: Send context to LLM → get tool call or final answer
 *   3. Act: Execute the tool → capture result
 *   4. Repeat until done or max iterations reached
 */

import { Page } from 'playwright';
import { BrowserManager } from './browser';
import { AgentConfig, AgentStep } from './types';
import { createProvider, LLMProvider, ChatMessage } from './providers';
import { getToolDefinitions, executeTool } from './tools';
import logger from './logger';

/** System prompt that defines the agent's identity and behavior */
const SYSTEM_PROMPT = `You are CognitionWeb, an intelligent browser automation agent.
You can control a web browser to navigate pages, fill forms, click buttons, and interact with web elements.

## Your Capabilities
You have access to the following tools:
- take_screenshot: Capture what's currently visible on screen
- open_browser: Initialize the browser (already done for you)
- navigate_to_url: Go to a specific URL
- click_on_screen: Click at (x, y) coordinates
- send_keys: Type text into fields (use selector parameter for reliable input)
- scroll: Scroll the page in any direction
- double_click: Double-click at coordinates
- get_page_info: Extract structured data about form fields, buttons, and text on the page

## How to Work
1. Start by using get_page_info to understand the page structure
2. Use take_screenshot to see the visual layout if needed
3. To fill a form field, PREFER using send_keys with a CSS selector (more reliable than clicking + typing)
4. If send_keys with selector fails, fall back to: click_on_screen on the field → send_keys to type
5. After filling fields, look for a Submit button and click it
6. Always verify your actions worked by checking page info or taking a screenshot after

## Important Guidelines
- When you see form fields in get_page_info results, use the "selector" value with send_keys for reliable input
- Coordinates from get_page_info boundingBox: click the CENTER of the element (x + width/2, y + height/2)
- If an element is not visible, scroll down first
- If something fails, try an alternative approach before giving up
- When your task is complete, respond with a clear summary of what you accomplished (do NOT call any more tools)

## Completion
When you have finished the task, respond with a final message summarizing what you did. Do NOT call any tools in your final response.`;

/**
 * AutomationAgent — The core agent implementing the ReAct loop.
 */
export class AutomationAgent {
  private config: AgentConfig;
  private browserManager: BrowserManager;
  private provider: LLMProvider;
  private conversationHistory: ChatMessage[] = [];
  private steps: AgentStep[] = [];
  private page: Page | null = null;

  constructor(config: AgentConfig) {
    this.config = config;
    this.browserManager = new BrowserManager(config);
    this.provider = createProvider(config);
  }

  /**
   * Run the agent with a given task description.
   * This is the main entry point that orchestrates the full automation.
   */
  async run(task: string): Promise<string> {
    logger.info('═══════════════════════════════════════════════════', {});
    logger.info('CognitionWeb Agent Starting', {});
    logger.info(`Provider: ${this.provider.name} | Vision: ${this.provider.supportsVision}`, {});
    logger.info(`Target: ${this.config.targetUrl}`, {});
    logger.info(`Max Iterations: ${this.config.maxIterations}`, {});
    logger.info('═══════════════════════════════════════════════════', {});

    try {
      // Step 1: Launch browser and navigate to target
      await this.initialize();

      // Step 2: Set up the conversation with system prompt and task
      this.conversationHistory = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `## Your Task\n${task}\n\nThe browser is already open and navigated to ${this.config.targetUrl}. Start by using get_page_info to understand the page, then complete the task.`,
        },
      ];

      // Step 3: Run the ReAct loop
      const result = await this.agentLoop();

      // Step 4: Cleanup
      await this.cleanup();

      logger.info('═══════════════════════════════════════════════════', {});
      logger.info('Agent completed successfully', {});
      logger.info(`Total steps: ${this.steps.length}`, {});
      logger.info('═══════════════════════════════════════════════════', {});

      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Agent failed: ${errorMsg}`, {});
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Initialize the browser and navigate to the target URL.
   */
  private async initialize(): Promise<void> {
    logger.info('Initializing browser...', {});
    this.page = await this.browserManager.launch();

    logger.info(`Navigating to ${this.config.targetUrl}...`, {});
    await this.page.goto(this.config.targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for page to settle
    await this.page.waitForTimeout(3000);

    const title = await this.page.title();
    logger.info(`Page loaded: "${title}"`, {});
  }

  /**
   * The main ReAct loop — iterate until task completion or max iterations.
   */
  private async agentLoop(): Promise<string> {
    const toolDefs = getToolDefinitions();

    for (let iteration = 1; iteration <= this.config.maxIterations; iteration++) {
      logger.info(`\n──── Iteration ${iteration}/${this.config.maxIterations} ────`, {
        iteration,
      });

      try {
        // Send conversation to LLM
        const response = await this.provider.chat(this.conversationHistory, toolDefs);

        // If the model is done (final answer, no tool calls), return
        if (response.done || (response.toolCalls.length === 0 && response.content)) {
          const finalMessage = response.content || 'Task completed.';
          logger.info(`Agent finished: ${finalMessage.substring(0, 200)}`, { iteration });

          // Record this step
          this.steps.push({
            iteration,
            timestamp: new Date().toISOString(),
            action: 'final_answer',
            llmResponse: finalMessage,
          });

          return finalMessage;
        }

        // Process tool calls
        if (response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            logger.info(`Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments).substring(0, 100)})`, {
              iteration,
              tool: toolCall.name,
            });

            // Add assistant message with tool call to history
            // For providers that need it, we track the tool call in the conversation
            this.conversationHistory.push({
              role: 'assistant',
              content: response.content || `Calling tool: ${toolCall.name}`,
            });

            // Execute the tool
            const result = await executeTool(toolCall.name, toolCall.arguments, this.page);

            // Record the step
            this.steps.push({
              iteration,
              timestamp: new Date().toISOString(),
              action: 'tool_call',
              toolName: toolCall.name,
              toolArgs: toolCall.arguments,
              result,
            });

            // Build the tool result message
            let resultContent = `Tool "${toolCall.name}" result:\n`;
            resultContent += `Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n`;
            resultContent += `Message: ${result.message}\n`;

            if (result.data) {
              // Include data but limit size
              const dataStr = JSON.stringify(result.data, null, 2);
              resultContent += `Data: ${dataStr.substring(0, 3000)}\n`;
            }

            // Add screenshot as vision context if available and provider supports it
            if (result.screenshot && this.provider.supportsVision) {
              this.conversationHistory.push({
                role: 'user',
                content: resultContent,
                image: {
                  base64: result.screenshot,
                  mimeType: 'image/png',
                },
              });
            } else {
              this.conversationHistory.push({
                role: 'tool',
                content: resultContent,
                toolCallId: toolCall.id,
                toolName: toolCall.name,
              });
            }

            logger.info(`Tool result: ${result.success ? '✓' : '✗'} ${result.message.substring(0, 100)}`, {
              iteration,
              tool: toolCall.name,
            });
          }
        } else if (response.content) {
          // Model returned text but didn't signal done — add it and continue
          this.conversationHistory.push({
            role: 'assistant',
            content: response.content,
          });

          // Prompt the model to continue or finish
          this.conversationHistory.push({
            role: 'user',
            content: 'Continue with the task. If you are done, provide a final summary without calling any tools.',
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        logger.error(`Error in iteration ${iteration}: ${errorMsg}`, { iteration });

        // Add error context for the LLM to recover from
        this.conversationHistory.push({
          role: 'user',
          content: `An error occurred: ${errorMsg}. Please try a different approach or recover from this error.`,
        });

        this.steps.push({
          iteration,
          timestamp: new Date().toISOString(),
          action: 'error',
          result: {
            success: false,
            message: errorMsg,
            error: errorMsg,
          },
        });
      }
    }

    logger.warn(`Agent reached max iterations (${this.config.maxIterations})`, {});
    return `Task incomplete — reached maximum iterations (${this.config.maxIterations}). Last actions: ${this.steps.slice(-3).map((s) => s.toolName || s.action).join(', ')}`;
  }

  /**
   * Clean up resources (close browser).
   */
  private async cleanup(): Promise<void> {
    logger.info('Cleaning up...', {});
    await this.browserManager.close();
  }
}
