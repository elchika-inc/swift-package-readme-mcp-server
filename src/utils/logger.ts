export interface Logger {
  debug(message: string, meta?: unknown): void;
  info(message: string, meta?: unknown): void;
  warn(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
}

export class ConsoleLogger implements Logger {
  private logLevel: 'debug' | 'info' | 'warn' | 'error';

  constructor(logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.logLevel = logLevel;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: string, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    let formattedMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (meta !== undefined) {
      try {
        formattedMessage += ` ${JSON.stringify(meta)}`;
      } catch (error) {
        formattedMessage += ` [Meta serialization failed: ${error}]`;
      }
    }
    
    return formattedMessage;
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, meta));
    }
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, meta));
    }
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message, meta));
    }
  }

  error(message: string, meta?: unknown): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, meta));
    }
  }
}

// Export a default logger instance
export const logger = new ConsoleLogger(
  (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'warn'
);