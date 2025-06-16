import type { PackageReadmeMcpError, NetworkError, RateLimitError } from '../types/index.js';
import { logger } from './logger.js';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  backoffFactor: 2,
};

export class ErrorHandler {
  static isRetryableError(error: Error): boolean {
    if (error instanceof Error && 'statusCode' in error) {
      const statusCode = (error as PackageReadmeMcpError).statusCode;
      if (statusCode) {
        // Retry on 429 (rate limit), 500, 502, 503, 504
        return [429, 500, 502, 503, 504].includes(statusCode);
      }
    }

    // Retry on network errors
    if (error.name === 'NetworkError' || error.message.includes('fetch failed')) {
      return true;
    }

    return false;
  }

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error;

    for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt === opts.maxRetries) {
          logger.error(`Operation failed after ${opts.maxRetries + 1} attempts`, {
            error: lastError.message,
            attempts: attempt + 1,
          });
          throw lastError;
        }

        if (!this.isRetryableError(lastError)) {
          logger.debug('Error is not retryable, aborting', { error: lastError.message });
          throw lastError;
        }

        const delay = Math.min(
          opts.baseDelayMs * Math.pow(opts.backoffFactor, attempt),
          opts.maxDelayMs
        );

        logger.debug(`Retrying operation in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries: opts.maxRetries,
          error: lastError.message,
        });

        // Handle rate limit specifically
        if (lastError instanceof Error && 'statusCode' in lastError && 
            (lastError as PackageReadmeMcpError).statusCode === 429) {
          const rateLimitError = lastError as RateLimitError;
          if (rateLimitError.details && typeof rateLimitError.details === 'object' && 
              'retryAfter' in rateLimitError.details) {
            const retryAfter = (rateLimitError.details as { retryAfter: number }).retryAfter * 1000;
            await this.sleep(Math.max(delay, retryAfter));
          } else {
            await this.sleep(delay);
          }
        } else {
          await this.sleep(delay);
        }
      }
    }

    throw lastError!;
  }

  static async withTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number = 30000
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static handleUnknownError(error: unknown, context: string): PackageReadmeMcpError {
    logger.error(`Unknown error in ${context}`, { error });

    if (error instanceof Error) {
      // Re-throw known errors
      if (error.name === 'PackageReadmeMcpError') {
        return error as PackageReadmeMcpError;
      }

      // Convert network errors
      if (error.message.includes('fetch failed') || 
          error.message.includes('ENOTFOUND') ||
          error.message.includes('ECONNREFUSED')) {
        return {
          name: 'NetworkError',
          message: `Network error: ${error.message}`,
          code: 'NETWORK_ERROR',
        } as NetworkError;
      }

      // Convert timeout errors
      if (error.message.includes('timeout')) {
        return {
          name: 'NetworkError',
          message: `Request timeout: ${error.message}`,
          code: 'NETWORK_ERROR',
        } as NetworkError;
      }
    }

    // Default internal error
    return {
      name: 'PackageReadmeMcpError',
      message: `Internal error in ${context}: ${error instanceof Error ? error.message : String(error)}`,
      code: 'INTERNAL_ERROR',
    } as PackageReadmeMcpError;
  }
}