/**
 * CognitionWeb — Tool: take_screenshot
 *
 * Captures a screenshot of the current browser viewport or full page.
 * Saves the image to the screenshots/ directory and returns a base64
 * encoding for LLM vision analysis.
 */

import { Page } from 'playwright';
import path from 'path';
import fs from 'fs';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

// Ensure screenshots directory exists
const screenshotsDir = path.resolve(process.cwd(), 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const takeScreenshot: Tool = {
  name: 'take_screenshot',
  description:
    'Capture a screenshot of the current browser window. ' +
    'Returns the screenshot as a base64 image. Use this to see what is currently on screen.',
  parameters: {
    type: 'object',
    properties: {
      fullPage: {
        type: 'boolean',
        description: 'If true, capture the entire scrollable page. If false (default), capture only the visible viewport.',
      },
    },
    required: [],
  },

  async execute(args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    if (!page) {
      return { success: false, message: 'Browser not launched', error: 'No active page' };
    }

    try {
      const fullPage = (args.fullPage as boolean) || false;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `screenshot-${timestamp}.png`;
      const filepath = path.join(screenshotsDir, filename);

      logger.info(`Taking screenshot (fullPage: ${fullPage})`, {
        tool: 'take_screenshot',
        filepath,
      });

      // Capture screenshot as buffer
      const buffer = await page.screenshot({
        fullPage,
        type: 'png',
      });

      // Save to disk
      fs.writeFileSync(filepath, buffer);

      // Convert to base64 for LLM
      const base64 = buffer.toString('base64');

      logger.info(`Screenshot saved: ${filename}`, { tool: 'take_screenshot' });

      return {
        success: true,
        message: `Screenshot captured and saved to ${filename}`,
        screenshot: base64,
        data: { filepath, filename, fullPage },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Screenshot failed: ${errorMsg}`, { tool: 'take_screenshot' });
      return { success: false, message: `Failed to take screenshot: ${errorMsg}`, error: errorMsg };
    }
  },
};

export default takeScreenshot;
