/**
 * CognitionWeb — Tool Registry & Dispatcher
 *
 * Central registry of all available tools. Exports tool definitions
 * for LLM function calling and a dispatcher to execute tools by name.
 */

import { Page } from 'playwright';
import { Tool, ToolDefinition, ToolResult } from '../types';
import logger from '../logger';

// Import all tools
import takeScreenshot from './take_screenshot';
import openBrowser from './open_browser';
import navigateToUrl from './navigate_to_url';
import clickOnScreen from './click_on_screen';
import sendKeys from './send_keys';
import scroll from './scroll';
import doubleClick from './double_click';
import getPageInfo from './get_page_info';

/** All registered tools */
export const tools: Tool[] = [
  takeScreenshot,
  openBrowser,
  navigateToUrl,
  clickOnScreen,
  sendKeys,
  scroll,
  doubleClick,
  getPageInfo,
];

/** Map of tool names to tool instances for fast lookup */
const toolMap = new Map<string, Tool>(
  tools.map((tool) => [tool.name, tool])
);

/**
 * Get tool definitions formatted for LLM function calling.
 * Returns an array of tool definitions with name, description, and parameter schemas.
 */
export function getToolDefinitions(): ToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}

/**
 * Execute a tool by name with the given arguments.
 *
 * @param name - The name of the tool to execute
 * @param args - Arguments to pass to the tool
 * @param page - The Playwright page instance (may be null for some tools)
 * @returns The tool result
 */
export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  page: Page | null
): Promise<ToolResult> {
  const tool = toolMap.get(name);

  if (!tool) {
    logger.error(`Unknown tool: ${name}`, { tool: 'dispatcher' });
    return {
      success: false,
      message: `Unknown tool "${name}". Available tools: ${tools.map((t) => t.name).join(', ')}`,
      error: `Tool not found: ${name}`,
    };
  }

  logger.info(`Executing tool: ${name}`, {
    tool: name,
    args: JSON.stringify(args).substring(0, 200),
  });

  try {
    const result = await tool.execute(args, page);

    if (result.success) {
      logger.info(`Tool ${name} succeeded: ${result.message}`, { tool: name });
    } else {
      logger.warn(`Tool ${name} failed: ${result.message}`, { tool: name });
    }

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error(`Tool ${name} threw an error: ${errorMsg}`, { tool: name });
    return {
      success: false,
      message: `Tool "${name}" encountered an unexpected error: ${errorMsg}`,
      error: errorMsg,
    };
  }
}

export default { tools, getToolDefinitions, executeTool };
