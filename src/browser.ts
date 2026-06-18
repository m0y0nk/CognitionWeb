/**
 * CognitionWeb — Browser Manager
 *
 * Manages the Playwright browser lifecycle. Provides a singleton-like
 * interface for launching, accessing, and closing the browser instance.
 * Supports chromium, firefox, and webkit browsers.
 */

import { Browser, BrowserContext, Page, chromium, firefox, webkit } from 'playwright';
import logger from './logger';
import { AgentConfig } from './types';

/** Map of browser type names to their Playwright launcher */
const BROWSER_LAUNCHERS = {
  chromium,
  firefox,
  webkit,
} as const;

/**
 * BrowserManager — Singleton class managing browser lifecycle.
 *
 * Handles browser launch, context creation, page management, and cleanup.
 * Configured via AgentConfig for headless mode, browser type, and viewport.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  /**
   * Launch the browser and create a new page.
   * Sets viewport to 1280x800 for consistent screenshot dimensions.
   */
  async launch(): Promise<Page> {
    const launcher = BROWSER_LAUNCHERS[this.config.browserType];
    if (!launcher) {
      throw new Error(`Unsupported browser type: ${this.config.browserType}`);
    }

    logger.info(`Launching ${this.config.browserType} browser`, {
      tool: 'BrowserManager',
      headless: this.config.headless,
    });

    this.browser = await launcher.launch({
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    this.page = await this.context.newPage();

    logger.info('Browser launched successfully', { tool: 'BrowserManager' });
    return this.page;
  }

  /**
   * Get the current active page.
   * Throws if the browser hasn't been launched yet.
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }
    return this.page;
  }

  /** Check if the browser is currently running */
  isLaunched(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Close the browser and clean up all resources.
   * Safe to call multiple times.
   */
  async close(): Promise<void> {
    logger.info('Closing browser', { tool: 'BrowserManager' });

    try {
      if (this.page) {
        await this.page.close().catch(() => {});
        this.page = null;
      }
      if (this.context) {
        await this.context.close().catch(() => {});
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close().catch(() => {});
        this.browser = null;
      }
      logger.info('Browser closed successfully', { tool: 'BrowserManager' });
    } catch (error) {
      logger.error('Error closing browser', {
        tool: 'BrowserManager',
        error: String(error),
      });
    }
  }
}
