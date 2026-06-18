/**
 * CognitionWeb — Entry Point
 *
 * Main entry point for the browser automation agent.
 * Loads configuration, creates the agent, and runs the target task.
 * Handles graceful shutdown on SIGINT/SIGTERM.
 */

import { loadConfig } from './config';
import { AutomationAgent } from './agent';
import { getProviderInfo } from './providers';
import logger from './logger';

/** The default task the agent will perform */
const DEFAULT_TASK = `
Navigate to the form demo section on this page.
Find the form with "Username" field (it may also be labeled "Name").
Fill in the Username/Name field with: Mayank Soni
You may also see a Bio/Description field — if present, fill it with: This form was filled by CognitionWeb, an AI-powered browser automation agent built with Playwright.
After filling in the fields, click the Submit button to submit the form.
Verify the form was submitted successfully by checking for any confirmation or toast message.
`;

async function main(): Promise<void> {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██████╗ ██████╗  ██████╗ ███╗   ██╗██╗████████╗██╗ ██████╗ ║
║  ██╔════╝██╔═══██╗██╔════╝ ████╗  ██║██║╚══██╔══╝██║██╔═══██╗║
║  ██║     ██║   ██║██║  ███╗██╔██╗ ██║██║   ██║   ██║██║   ██║║
║  ██║     ██║   ██║██║   ██║██║╚██╗██║██║   ██║   ██║██║   ██║║
║  ╚██████╗╚██████╔╝╚██████╔╝██║ ╚████║██║   ██║   ██║╚██████╔╝║
║   ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝╚═╝   ╚═╝   ╚═╝ ╚═════╝║
║                      W E B  A G E N T                         ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  try {
    // Load configuration
    const config = loadConfig();
    const providerInfo = getProviderInfo(config.llmProvider);

    console.log(`  Provider : ${providerInfo.description}`);
    console.log(`  Model    : ${providerInfo.model}`);
    console.log(`  Vision   : ${providerInfo.supportsVision ? '✅ Enabled' : '❌ Disabled (using DOM analysis)'}`);
    console.log(`  Browser  : ${config.browserType} (${config.headless ? 'headless' : 'headful'})`);
    console.log(`  Target   : ${config.targetUrl}`);
    console.log(`  Max Iter : ${config.maxIterations}`);
    console.log('');

    // Get task from CLI args or use default
    const customTask = process.argv[2];
    const task = customTask || DEFAULT_TASK;

    if (customTask) {
      logger.info(`Custom task provided: ${customTask.substring(0, 100)}...`);
    }

    // Create and run the agent
    const agent = new AutomationAgent(config);

    // Handle graceful shutdown
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log(`\n\n  ⚠️  Received ${signal} — shutting down gracefully...`);
      logger.info(`Received ${signal}, shutting down`, {});
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Run the agent
    console.log('  🚀 Starting automation...\n');
    const result = await agent.run(task);

    console.log('\n  ════════════════════════════════════════');
    console.log('  ✅ Agent completed!');
    console.log('  ════════════════════════════════════════');
    console.log(`\n  Result:\n  ${result.substring(0, 500)}`);
    console.log('\n  📁 Screenshots saved to: ./screenshots/');
    console.log('  📋 Logs saved to: ./logs/agent.log');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`\n  ❌ Agent failed: ${errorMsg}`);
    logger.error(`Fatal error: ${errorMsg}`, {});
    process.exit(1);
  }
}

// Run
main();
