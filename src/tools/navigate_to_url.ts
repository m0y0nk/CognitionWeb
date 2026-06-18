/**
 * CognitionWeb — Tool: navigate_to_url
 *
 * Navigates the browser to a specified URL and waits for the page to load.
 * Returns the page title and final URL (after any redirects).
 */

import { Page } from 'playwright';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

const navigateToUrl: Tool = {
  name: 'navigate_to_url',
  description:
    'Navigate the browser to a specific URL. Waits for the page to finish loading. ' +
    'Returns the page title and current URL after navigation.',
  parameters: {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The full URL to navigate to (e.g., "https://example.com")',
      },
    },
    required: ['url'],
  },

  async execute(args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    if (!page) {
      return { success: false, message: 'Browser not launched', error: 'No active page' };
    }

    const url = args.url as string;
    if (!url) {
      return { success: false, message: 'URL is required', error: 'Missing url parameter' };
    }

    try {
      logger.info(`Navigating to: ${url}`, { tool: 'navigate_to_url' });

      // Navigate with a generous timeout and wait for DOM to be ready
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });

      // Wait a bit more for dynamic content to settle
      await page.waitForTimeout(2000);

      const title = await page.title();
      const currentUrl = page.url();

      logger.info(`Navigation complete: "${title}" at ${currentUrl}`, {
        tool: 'navigate_to_url',
      });

      return {
        success: true,
        message: `Successfully navigated to "${title}" (${currentUrl})`,
        data: { title, url: currentUrl },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Navigation failed: ${errorMsg}`, { tool: 'navigate_to_url', url });
      return {
        success: false,
        message: `Failed to navigate to ${url}: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};

export default navigateToUrl;
