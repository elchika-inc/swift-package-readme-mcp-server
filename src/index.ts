#!/usr/bin/env node

import { SwiftPackageReadmeMcpServer } from './server.js';
import { logger } from './utils/logger.js';

async function main() {
  const server = new SwiftPackageReadmeMcpServer();
  
  // Handle graceful shutdown
  const cleanup = async () => {
    logger.info('Shutting down server...');
    try {
      await server.stop();
      logger.info('Server stopped gracefully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', { error });
      process.exit(1);
    }
  };

  // Register signal handlers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGUSR2', cleanup); // For nodemon

  try {
    logger.info('Starting Swift Package README MCP Server...');
    await server.run();
    logger.info('Server started successfully');
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', { reason, promise });
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

main().catch((error) => {
  logger.error('Fatal error in main', { error });
  process.exit(1);
});