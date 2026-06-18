/**
 * CognitionWeb — Tool: open_browser
 *
 * Initializes and launches a browser instance. This tool is called
 * at the start of an automation session to prepare the browser.
 * The actual browser launch is delegated to BrowserManager; this
 * tool acts as the LLM-callable interface.
 */

import { Page } from 'playwright';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

const openBrowser: Tool = {
  name: 'open_browser',
  description:
    'Initialize and launch a browser instance. Call this before any other browser actions. ' +
    'The browser will open with a default viewport of 1280x800 pixels.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute(_args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    try {
      // The browser is managed by the agent, so this tool just verifies it's ready
      if (page) {
        logger.info('Browser is already open and ready', { tool: 'open_browser' });
        return {
          success: true,
          message: 'Browser is already open and ready for use.',
          data: {
            viewportSize: page.viewportSize(),
            url: page.url(),
          },
        };
      }

      // If page is null, the agent needs to handle launching
      logger.warn('Browser not yet launched — agent will handle initialization', {
        tool: 'open_browser',
      });

      return {
        success: true,
        message: 'Browser launch requested. The browser will be initialized by the agent.',
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to open browser: ${errorMsg}`, { tool: 'open_browser' });
      return { success: false, message: `Failed to open browser: ${errorMsg}`, error: errorMsg };
    }
  },
};

export default openBrowser;
