/**
 * Logger Utility
 * Simpele logger met verschillende levels
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface LoggerOptions {
  level?: LogLevel;
  format?: 'json' | 'text';
  prefix?: string;
}

export class Logger {
  private level: LogLevel;
  private format: 'json' | 'text';
  private prefix?: string;

  private levelPriority: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    silent: 999,
  };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.format = options.format || 'text';
    this.prefix = options.prefix;
  }

  /**
   * Log debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  /**
   * Log info message
   */
  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  /**
   * Log warning message
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  /**
   * Log error message
   */
  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): void {
    // Check if we should log this level
    if (this.levelPriority[level] < this.levelPriority[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}]` : '';

    if (this.format === 'json') {
      console.log(
        JSON.stringify({
          timestamp,
          level,
          prefix: this.prefix,
          message,
          ...meta,
        })
      );
    } else {
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
      console.log(`${timestamp} ${prefix} [${level.toUpperCase()}] ${message}${metaStr}`);
    }
  }

  /**
   * Create child logger with prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      level: this.level,
      format: this.format,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
    });
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

// =============================================================================
// Default Logger
// =============================================================================

export const logger = new Logger({ level: 'info' });

// =============================================================================
// Factory Function
// =============================================================================

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}
