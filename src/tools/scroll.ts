/**
 * CognitionWeb — Tool: scroll
 *
 * Scrolls the page in a specified direction by a given number of pixels.
 * Useful for revealing form elements or content below the fold.
 */

import { Page } from 'playwright';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

const scroll: Tool = {
  name: 'scroll',
  description:
    'Scroll the page in a specified direction. ' +
    'Use this to reveal content that is not currently visible in the viewport. ' +
    'Default scroll amount is 300 pixels.',
  parameters: {
    type: 'object',
    properties: {
      direction: {
        type: 'string',
        description: 'Direction to scroll: "up", "down", "left", or "right"',
        enum: ['up', 'down', 'left', 'right'],
      },
      amount: {
        type: 'number',
        description: 'Number of pixels to scroll (default: 300)',
      },
    },
    required: ['direction'],
  },

  async execute(args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    if (!page) {
      return { success: false, message: 'Browser not launched', error: 'No active page' };
    }

    const direction = args.direction as string;
    const amount = (args.amount as number) || 300;

    if (!['up', 'down', 'left', 'right'].includes(direction)) {
      return {
        success: false,
        message: `Invalid direction "${direction}". Use: up, down, left, right`,
        error: 'Invalid direction',
      };
    }

    try {
      logger.info(`Scrolling ${direction} by ${amount}px`, { tool: 'scroll' });

      // Calculate scroll deltas
      let deltaX = 0;
      let deltaY = 0;

      switch (direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }

      // Perform scroll using mouse wheel
      await page.mouse.wheel(deltaX, deltaY);

      // Wait for scroll to settle and any lazy-loaded content
      await page.waitForTimeout(500);

      // Get current scroll position
      const scrollPos = await page.evaluate(() => ({
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      }));

      logger.info(
        `Scrolled ${direction} by ${amount}px. Position: (${scrollPos.scrollX}, ${scrollPos.scrollY})`,
        { tool: 'scroll' }
      );

      return {
        success: true,
        message: `Scrolled ${direction} by ${amount}px. Current position: (${scrollPos.scrollX}, ${scrollPos.scrollY}). Page height: ${scrollPos.scrollHeight}px, Viewport height: ${scrollPos.clientHeight}px`,
        data: {
          direction,
          amount,
          ...scrollPos,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Scroll failed: ${errorMsg}`, { tool: 'scroll' });
      return {
        success: false,
        message: `Failed to scroll ${direction}: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};

export default scroll;
