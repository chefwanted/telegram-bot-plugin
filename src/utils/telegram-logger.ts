/**
 * Telegram Interaction Logger
 * Logs all bot interactions: messages, commands, callbacks, errors
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Message, CallbackQuery } from '../types/telegram';

const LOGS_DIR = '/tmp/telegram-bot-logs';
const LOG_FILE = path.join(LOGS_DIR, 'interactions.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOG_FILES = 5;

// Ensure logs directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
}

/**
 * Log entry structure
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  type: LogType;
  chatId: number;
  userId?: number;
  userName?: string;
  messageId?: number;
  data: Record<string, unknown>;
}

/**
 * Types of loggable events
 */
export type LogType =
  | 'MESSAGE_RECEIVED'
  | 'COMMAND_RECEIVED'
  | 'CALLBACK_QUERY'
  | 'BOT_RESPONSE'
  | 'STREAM_START'
  | 'STREAM_END'
  | 'TOOL_EXECUTION'
  | 'TOOL_CONFIRMATION'
  | 'SESSION_START'
  | 'SESSION_END'
  | 'ERROR'
  | 'API_CALL'
  | 'FILE_OPERATION';

/**
 * Telegram Interaction Logger
 */
export class TelegramLogger {
  private static instance: TelegramLogger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): TelegramLogger {
    if (!TelegramLogger.instance) {
      TelegramLogger.instance = new TelegramLogger();
    }
    return TelegramLogger.instance;
  }

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARNING, LogLevel.ERROR];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  /**
   * Format log entry
   */
  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, type, chatId, userId, userName, messageId, data } = entry;
    const userInfo = userId ? `${userName || 'Unknown'} (${userId})` : 'System';
    const msgInfo = messageId ? ` [msg:${messageId}]` : '';
    const dataStr = Object.keys(data).length > 0 ? ` ${JSON.stringify(data)}` : '';
    
    return `[${timestamp}] [${level}] [${type}] Chat:${chatId} User:${userInfo}${msgInfo}${dataStr}`;
  }

  /**
   * Write to log file with rotation
   */
  private writeToFile(logLine: string): void {
    try {
      // Check file size and rotate if needed
      if (fs.existsSync(LOG_FILE)) {
        const stats = fs.statSync(LOG_FILE);
        if (stats.size > MAX_LOG_SIZE) {
          this.rotateLogs();
        }
      }
      
      fs.appendFileSync(LOG_FILE, logLine + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  /**
   * Rotate old log files
   */
  private rotateLogs(): void {
    try {
      // Remove oldest
      const oldest = path.join(LOGS_DIR, `interactions.log.${MAX_LOG_FILES}`);
      if (fs.existsSync(oldest)) {
        fs.unlinkSync(oldest);
      }
      
      // Shift others
      for (let i = MAX_LOG_FILES - 1; i >= 1; i--) {
        const oldPath = path.join(LOGS_DIR, `interactions.log.${i}`);
        const newPath = path.join(LOGS_DIR, `interactions.log.${i + 1}`);
        if (fs.existsSync(oldPath)) {
          fs.renameSync(oldPath, newPath);
        }
      }
      
      // Rename current to .1
      fs.renameSync(LOG_FILE, path.join(LOGS_DIR, 'interactions.log.1'));
    } catch (error) {
      console.error('Failed to rotate logs:', error);
    }
  }

  /**
   * Create log entry
   */
  private createEntry(
    type: LogType,
    chatId: number,
    message: Message | CallbackQuery | null,
    level: LogLevel,
    data: Record<string, unknown>
  ): LogEntry {
    const timestamp = new Date().toISOString();
    let userId: number | undefined;
    let userName: string | undefined;
    let messageId: number | undefined;

    if (message) {
      if ('from' in message && message.from) {
        userId = message.from.id;
        userName = message.from.first_name || message.from.username || 'Unknown';
      }
      if ('message_id' in message) {
        messageId = message.message_id;
      }
    }

    return {
      timestamp,
      level,
      type,
      chatId,
      userId,
      userName,
      messageId,
      data,
    };
  }

  /**
   * Log message received
   */
  logMessage(message: Message, text: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createEntry(
      'MESSAGE_RECEIVED',
      message.chat.id,
      message,
      LogLevel.INFO,
      {
        textLength: text.length,
        textPreview: text.substring(0, 100),
        hasEntities: (message.entities?.length || 0) > 0,
      }
    );

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log command received
   */
  logCommand(message: Message, command: string, args: string[]): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createEntry(
      'COMMAND_RECEIVED',
      message.chat.id,
      message,
      LogLevel.INFO,
      {
        command,
        args,
        argsCount: args.length,
      }
    );

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log callback query
   */
  logCallbackQuery(callback: CallbackQuery): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createEntry(
      'CALLBACK_QUERY',
      callback.message?.chat.id || 0,
      callback,
      LogLevel.INFO,
      {
        data: callback.data,
        messageId: callback.message?.message_id,
      }
    );

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log bot response
   */
  logResponse(chatId: number, responseType: string, details: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      type: 'BOT_RESPONSE',
      chatId,
      data: { responseType, ...details },
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log stream start/end
   */
  logStream(action: 'START' | 'END', chatId: number, messageId: number, details: Record<string, unknown>): void {
    const type = action === 'START' ? 'STREAM_START' : 'STREAM_END';
    const level = action === 'START' ? LogLevel.INFO : LogLevel.DEBUG;

    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      chatId,
      messageId,
      data: details,
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log tool execution
   */
  logToolExecution(chatId: number, toolName: string, args: Record<string, unknown>, result: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      type: 'TOOL_EXECUTION',
      chatId,
      data: {
        tool: toolName,
        args: JSON.stringify(args).substring(0, 200),
        resultSuccess: result.success,
        duration: result.duration,
      },
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log tool confirmation request
   */
  logToolConfirmation(chatId: number, toolName: string, confirmationId: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      type: 'TOOL_CONFIRMATION',
      chatId,
      data: {
        tool: toolName,
        confirmationId,
      },
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log session start/end
   */
  logSession(action: 'START' | 'END', chatId: number, userId?: number, details?: Record<string, unknown>): void {
    const type = action === 'START' ? 'SESSION_START' : 'SESSION_END';
    const level = LogLevel.INFO;

    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      type,
      chatId,
      userId,
      data: details || {},
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log error
   */
  logError(chatId: number, error: Error | string, context?: Record<string, unknown>): void {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorStack = error instanceof Error ? error.stack : undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      type: 'ERROR',
      chatId,
      data: {
        message: errorMessage,
        stack: errorStack,
        ...context,
      },
    };

    const logLine = this.formatEntry(entry);
    console.error(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log API call
   */
  logApiCall(method: string, chatId: number, params?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      type: 'API_CALL',
      chatId,
      data: {
        method,
        params: params ? JSON.stringify(params).substring(0, 200) : undefined,
      },
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Log file operation
   */
  logFileOperation(chatId: number, operation: string, filePath: string, success: boolean): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: success ? LogLevel.INFO : LogLevel.WARNING,
      type: 'FILE_OPERATION',
      chatId,
      data: {
        operation,
        filePath: filePath.substring(0, 100),
        success,
      },
    };

    const logLine = this.formatEntry(entry);
    console.log(logLine);
    this.writeToFile(logLine);
  }

  /**
   * Get recent logs
   */
  getRecentLogs(lines: number = 100): string[] {
    try {
      if (!fs.existsSync(LOG_FILE)) {
        return [];
      }
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const allLines = content.split('\n').filter(Boolean);
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }

  /**
   * Get logs by chat ID
   */
  getLogsByChat(chatId: number, lines: number = 50): string[] {
    try {
      if (!fs.existsSync(LOG_FILE)) {
        return [];
      }
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const allLines = content.split('\n').filter(Boolean);
      const matching = allLines.filter(line => line.includes(`Chat:${chatId}`));
      return matching.slice(-lines);
    } catch {
      return [];
    }
  }

  /**
   * Search logs
   */
  searchLogs(query: string, lines: number = 100): string[] {
    try {
      if (!fs.existsSync(LOG_FILE)) {
        return [];
      }
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const allLines = content.split('\n').filter(Boolean);
      const matching = allLines.filter(line => line.toLowerCase().includes(query.toLowerCase()));
      return matching.slice(-lines);
    } catch {
      return [];
    }
  }

  /**
   * Get log file path
   */
  getLogPath(): string {
    return LOG_FILE;
  }

  /**
   * Get log directory
   */
  getLogDir(): string {
    return LOGS_DIR;
  }
}

// Export singleton instance
export const telegramLogger = TelegramLogger.getInstance();
