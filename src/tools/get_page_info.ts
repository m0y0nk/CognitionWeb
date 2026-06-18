/**
 * CognitionWeb — Tool: get_page_info
 *
 * Extracts structured information about the current page state,
 * including form fields, clickable elements, and visible text.
 * This gives the LLM semantic understanding beyond just screenshots.
 */

import { Page } from 'playwright';
import { Tool, ToolResult, PageInfo } from '../types';
import logger from '../logger';

const getPageInfo: Tool = {
  name: 'get_page_info',
  description:
    'Extract structured information about the current page. ' +
    'Returns form fields (with labels, types, values, coordinates), ' +
    'clickable elements (buttons, links), and a text summary. ' +
    'Use this to understand the page layout and find elements to interact with.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute(_args: Record<string, unknown>, page: Page | null): Promise<ToolResult> {
    if (!page) {
      return { success: false, message: 'Browser not launched', error: 'No active page' };
    }

    try {
      logger.info('Extracting page information', { tool: 'get_page_info' });

      const title = await page.title();
      const url = page.url();

      // Extract form fields
      const formFields = await page.evaluate(() => {
        const fields: Array<{
          label: string;
          type: string;
          value: string;
          placeholder: string;
          selector: string;
          boundingBox: { x: number; y: number; width: number; height: number } | null;
        }> = [];

        // Find all input, textarea, and select elements
        const inputs = document.querySelectorAll('input, textarea, select');
        inputs.forEach((input, index) => {
          const el = input as HTMLInputElement;
          const rect = el.getBoundingClientRect();

          // Skip hidden elements
          if (rect.width === 0 || rect.height === 0) return;

          // Try to find the associated label
          let label = '';
          if (el.id) {
            const labelEl = document.querySelector(`label[for="${el.id}"]`);
            if (labelEl) label = labelEl.textContent?.trim() || '';
          }
          if (!label) {
            const parent = el.closest('div, fieldset, label');
            const labelEl = parent?.querySelector('label');
            if (labelEl) label = labelEl.textContent?.trim() || '';
          }
          if (!label && el.getAttribute('aria-label')) {
            label = el.getAttribute('aria-label') || '';
          }
          if (!label && el.name) {
            label = el.name;
          }

          // Build a reliable selector
          let selector = '';
          if (el.id) {
            selector = `#${el.id}`;
          } else if (el.name) {
            selector = `${el.tagName.toLowerCase()}[name="${el.name}"]`;
          } else {
            selector = `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
          }

          fields.push({
            label,
            type: el.type || el.tagName.toLowerCase(),
            value: el.value || '',
            placeholder: el.placeholder || '',
            selector,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          });
        });

        return fields;
      });

      // Extract clickable elements (buttons and links)
      const clickableElements = await page.evaluate(() => {
        const elements: Array<{
          text: string;
          tagName: string;
          role: string;
          selector: string;
          boundingBox: { x: number; y: number; width: number; height: number } | null;
        }> = [];

        const clickables = document.querySelectorAll(
          'button, a[href], [role="button"], input[type="submit"], input[type="button"]'
        );

        clickables.forEach((el, index) => {
          const rect = el.getBoundingClientRect();

          // Skip hidden or off-screen elements
          if (rect.width === 0 || rect.height === 0) return;
          if (rect.y < -100 || rect.y > window.innerHeight + 100) return;

          const text = (el as HTMLElement).innerText?.trim().substring(0, 100) ||
                       el.getAttribute('aria-label') ||
                       el.getAttribute('title') || '';

          // Only include elements with meaningful text
          if (!text) return;

          let selector = '';
          if (el.id) {
            selector = `#${el.id}`;
          } else {
            selector = `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
          }

          elements.push({
            text,
            tagName: el.tagName.toLowerCase(),
            role: el.getAttribute('role') || el.tagName.toLowerCase(),
            selector,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          });
        });

        return elements.slice(0, 30); // Limit to 30 most relevant
      });

      // Extract visible text summary
      const textSummary = await page.evaluate(() => {
        const body = document.body;
        if (!body) return '';

        // Get visible text from main content areas
        const mainContent =
          document.querySelector('main') ||
          document.querySelector('[role="main"]') ||
          document.querySelector('article') ||
          body;

        const text = (mainContent as HTMLElement).innerText || '';
        // Truncate to first 2000 chars for context window efficiency
        return text.substring(0, 2000).replace(/\s+/g, ' ').trim();
      });

      const pageInfo: PageInfo = {
        title,
        url,
        formFields,
        clickableElements,
        textSummary,
      };

      logger.info(
        `Page info extracted: ${formFields.length} form fields, ${clickableElements.length} clickable elements`,
        { tool: 'get_page_info' }
      );

      return {
        success: true,
        message: `Page: "${title}" | ${formFields.length} form fields | ${clickableElements.length} clickable elements`,
        data: pageInfo as unknown as Record<string, unknown>,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get page info: ${errorMsg}`, { tool: 'get_page_info' });
      return {
        success: false,
        message: `Failed to extract page information: ${errorMsg}`,
        error: errorMsg,
      };
    }
  },
};

export default getPageInfo;
