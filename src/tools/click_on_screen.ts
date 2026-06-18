/**
 * CognitionWeb — Tool: click_on_screen
 *
 * Performs a mouse click at specified (x, y) coordinates on the page.
 * Reports what element was clicked based on the coordinates.
 */

import { Page } from 'playwright';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

const clickOnScreen: Tool = {
  name: 'click_on_screen',
  description:
    'Click at specific (x, y) coordinates on the page. ' +
    'Use this to click buttons, links, input fields, or any other elements. ' +
    'Coordinates are relative to the viewport (top-left is 0,0).',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'The x-coordinate (horizontal position) to click at',
      },
      y: {
        type: 'number',
        description: 'The y-coordinate (vertical position) to click at',
      },
    },
    required: ['x', 'y'],
  },

  async execute(args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    if (!page) {
      return { success: false, message: 'Browser not launched', error: 'No active page' };
    }

    const x = args.x as number;
    const y = args.y as number;

    if (typeof x !== 'number' || typeof y !== 'number') {
      return {
        success: false,
        message: 'Both x and y coordinates are required as numbers',
        error: 'Invalid coordinates',
      };
    }

    try {
      logger.info(`Clicking at (${x}, ${y})`, { tool: 'click_on_screen' });

      // Try to identify what's at the click point
      const elementInfo = await page.evaluate(
        ({ cx, cy }) => {
          const el = document.elementFromPoint(cx, cy);
          if (!el) return null;
          return {
            tagName: el.tagName.toLowerCase(),
            text: (el as HTMLElement).innerText?.substring(0, 100) || '',
            className: el.className?.toString().substring(0, 100) || '',
            id: el.id || '',
            type: (el as HTMLInputElement).type || '',
          };
        },
        { cx: x, cy: y }
      );

      // Perform the click
      await page.mouse.click(x, y);

      // Small delay to let any UI changes settle
      await page.waitForTimeout(500);

      const elementDesc = elementInfo
        ? `<${elementInfo.tagName}${elementInfo.id ? ` id="${elementInfo.id}"` : ''}${elementInfo.type ? ` type="${elementInfo.type}"` : ''}> "${elementInfo.text.substring(0, 50)}"`
        : 'unknown element';

      logger.info(`Clicked on ${elementDesc}`, { tool: 'click_on_screen', x, y });

      return {
        success: true,
        message: `Clicked at (${x}, ${y}) on ${elementDesc}`,
        data: { x, y, element: elementInfo },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Click failed at (${x}, ${y}): ${errorMsg}`, {
        tool: 'click_on_screen',
      });
      return {
        success: false,
        message: `Failed to click at (${x}, ${y}): ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};

export default clickOnScreen;
