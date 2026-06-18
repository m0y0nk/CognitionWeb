/**
 * CognitionWeb — Tool: double_click
 *
 * Performs a double-click at specified (x, y) coordinates on the page.
 * Useful for selecting text or triggering double-click actions.
 */

import { Page } from 'playwright';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

const doubleClick: Tool = {
  name: 'double_click',
  description:
    'Perform a double-click at specific (x, y) coordinates on the page. ' +
    'Use this for selecting text, opening items, or triggering double-click events. ' +
    'Coordinates are relative to the viewport (top-left is 0,0).',
  parameters: {
    type: 'object',
    properties: {
      x: {
        type: 'number',
        description: 'The x-coordinate (horizontal position) to double-click at',
      },
      y: {
        type: 'number',
        description: 'The y-coordinate (vertical position) to double-click at',
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
      logger.info(`Double-clicking at (${x}, ${y})`, { tool: 'double_click' });

      // Identify the element at the click point
      const elementInfo = await page.evaluate(
        ({ cx, cy }) => {
          const el = document.elementFromPoint(cx, cy);
          if (!el) return null;
          return {
            tagName: el.tagName.toLowerCase(),
            text: (el as HTMLElement).innerText?.substring(0, 100) || '',
            id: el.id || '',
          };
        },
        { cx: x, cy: y }
      );

      // Perform the double click
      await page.mouse.dblclick(x, y);

      // Wait for UI changes
      await page.waitForTimeout(500);

      const elementDesc = elementInfo
        ? `<${elementInfo.tagName}${elementInfo.id ? ` id="${elementInfo.id}"` : ''}> "${elementInfo.text.substring(0, 50)}"`
        : 'unknown element';

      logger.info(`Double-clicked on ${elementDesc}`, { tool: 'double_click', x, y });

      return {
        success: true,
        message: `Double-clicked at (${x}, ${y}) on ${elementDesc}`,
        data: { x, y, element: elementInfo },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Double-click failed at (${x}, ${y}): ${errorMsg}`, {
        tool: 'double_click',
      });
      return {
        success: false,
        message: `Failed to double-click at (${x}, ${y}): ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};

export default doubleClick;
