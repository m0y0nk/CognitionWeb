/**
 * CognitionWeb — Tool: send_keys
 *
 * Types text into the currently focused element or a specified element.
 * Supports regular text input and special keys (Enter, Tab, Escape, etc.).
 */

import { Page } from 'playwright';
import { Tool, ToolResult } from '../types';
import logger from '../logger';

/** Special key names that Playwright recognizes */
const SPECIAL_KEYS = [
  'Enter', 'Tab', 'Escape', 'Backspace', 'Delete',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Home', 'End', 'PageUp', 'PageDown',
  'Control', 'Shift', 'Alt', 'Meta',
];

const sendKeys: Tool = {
  name: 'send_keys',
  description:
    'Type text into the currently focused input field, or into a specific element using a CSS selector. ' +
    'Can also send special keys like Enter, Tab, Backspace. ' +
    'If using a selector, the element will be focused first, its content cleared, then the text typed.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to type. For special keys, use key names like "Enter", "Tab", "Backspace".',
      },
      selector: {
        type: 'string',
        description: 'Optional CSS selector to target a specific input element. If not provided, types into the currently focused element.',
      },
      pressEnter: {
        type: 'boolean',
        description: 'If true, press Enter after typing the text.',
      },
    },
    required: ['text'],
  },

  async execute(args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    if (!page) {
      return { success: false, message: 'Browser not launched', error: 'No active page' };
    }

    const text = args.text as string;
    const selector = args.selector as string | undefined;
    const pressEnter = (args.pressEnter as boolean) || false;

    if (!text) {
      return { success: false, message: 'Text is required', error: 'Missing text parameter' };
    }

    try {
      // Check if this is a special key press
      if (SPECIAL_KEYS.includes(text)) {
        logger.info(`Pressing special key: ${text}`, { tool: 'send_keys' });
        await page.keyboard.press(text);

        return {
          success: true,
          message: `Pressed special key: ${text}`,
          data: { key: text, isSpecialKey: true },
        };
      }

      // If a selector is provided, use page.fill() for reliable input
      if (selector) {
        logger.info(`Filling "${text}" into selector: ${selector}`, { tool: 'send_keys' });

        // Wait for the element to be visible and fill it
        await page.waitForSelector(selector, { timeout: 5000 });
        await page.fill(selector, text);

        if (pressEnter) {
          await page.keyboard.press('Enter');
        }

        return {
          success: true,
          message: `Typed "${text}" into element matching "${selector}"${pressEnter ? ' and pressed Enter' : ''}`,
          data: { text, selector, pressEnter },
        };
      }

      // No selector — type into the currently focused element
      logger.info(`Typing "${text}" into focused element`, { tool: 'send_keys' });

      // Use keyboard.type for natural typing into focused element
      await page.keyboard.type(text, { delay: 50 });

      if (pressEnter) {
        await page.keyboard.press('Enter');
      }

      return {
        success: true,
        message: `Typed "${text}" into the focused element${pressEnter ? ' and pressed Enter' : ''}`,
        data: { text, pressEnter },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to send keys: ${errorMsg}`, {
        tool: 'send_keys',
        text,
        selector,
      });
      return {
        success: false,
        message: `Failed to type text: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};

export default sendKeys;
