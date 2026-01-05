/**
 * Configuration Loader
 * Laadt configuratie uit environment variables en config bestanden
 */

import type { PluginConfig, PluginOptions } from '../types/plugin';
import { logger } from './logger';

// =============================================================================
// Config Validation
// =============================================================================

export function validateConfig(config: Partial<PluginConfig>): config is PluginConfig {
  if (!config.botToken) {
    logger.error('BOT_TOKEN environment variable is required');
    return false;
  }

  if (typeof config.botToken !== 'string' || config.botToken.length < 10) {
    logger.error('BOT_TOKEN must be a valid Telegram bot token');
    return false;
  }

  return true;
}

// =============================================================================
// Config Loader
// =============================================================================

export function loadConfig(): Partial<PluginConfig> {
  const config: Partial<PluginConfig> = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN,
    // Prefer Z.ai API key over Anthropic
    zaiApiKey: process.env.ZAI_API_KEY || process.env.ANTHROPIC_API_KEY,
    options: loadOptions(),
  };

  return config;
}

export function loadOptions(): PluginOptions | undefined {
  const options: PluginOptions = {};

  // Polling options
  if (process.env.POLLING_ENABLED !== 'false') {
    options.polling = {
      interval: parseInt(process.env.POLLING_INTERVAL || '300', 10),
      autoStart: process.env.POLLING_AUTO_START !== 'false',
      stopOnError: process.env.POLLING_STOP_ON_ERROR !== 'false',
      maxRetries: parseInt(process.env.POLLING_MAX_RETRIES || '3', 10),
      timeout: parseInt(process.env.POLLING_TIMEOUT || '30000', 10),
    };
  }

  // Session options
  if (process.env.SESSION_TTL || process.env.SESSION_MAX) {
    options.session = {
      ttl: parseInt(process.env.SESSION_TTL || '3600', 10),
      maxSessions: parseInt(process.env.SESSION_MAX || '1000', 10),
      storage: (process.env.SESSION_STORAGE as any) || 'memory',
      cleanupInterval: parseInt(process.env.SESSION_CLEANUP_INTERVAL || '60000', 10),
    };
  }

  // API options
  if (process.env.API_BASE_URL || process.env.API_TIMEOUT) {
    options.api = {
      baseUrl: process.env.API_BASE_URL,
      timeout: parseInt(process.env.API_TIMEOUT || '30000', 10),
      maxRetries: parseInt(process.env.API_MAX_RETRIES || '3', 10),
      retryDelay: parseInt(process.env.API_RETRY_DELAY || '1000', 10),
    };
  }

  // Logging options
  if (process.env.LOG_LEVEL || process.env.LOG_FORMAT) {
    options.logging = {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'text',
    };
  }

  // Claude options
  if (process.env.CLAUDE_MODEL || process.env.CLAUDE_MAX_TOKENS) {
    options.claude = {
      model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
      maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096', 10),
      temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7'),
      maxHistoryMessages: parseInt(process.env.CLAUDE_MAX_HISTORY || '50', 10),
    };
  }

  // Webhook options
  if (process.env.WEBHOOK_URL) {
    options.webhook = {
      url: process.env.WEBHOOK_URL,
      port: parseInt(process.env.WEBHOOK_PORT || '3000', 10),
      host: process.env.WEBHOOK_HOST || '0.0.0.0',
      path: process.env.WEBHOOK_PATH || '/telegram-webhook',
      healthCheck: {
        path: '/health',
        enabled: true,
      },
    };
  }

  // Return undefined if no options set
  return Object.keys(options).length > 0 ? options : undefined;
}

// =============================================================================
// Config Helpers
// =============================================================================

/**
 * Get BOT_TOKEN from environment
 */
export function getBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Get environment name
 */
export function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

// =============================================================================
// Config File Loader (optional)
// =============================================================================

interface ConfigFile {
  botToken?: string;
  options?: PluginOptions;
}

export async function loadConfigFile(path: string): Promise<Partial<PluginConfig>> {
  try {
    // Try to import config file
    const config = await import(path);
    return config.default || config;
  } catch (error) {
    logger.debug(`No config file found at ${path}`);
    return {};
  }
}

// =============================================================================
// Config Merger
// =============================================================================

export function mergeConfig(
  ...configs: Partial<PluginConfig>[]
): Partial<PluginConfig> {
  return configs.reduce((merged, config) => {
    return {
      ...merged,
      ...config,
      options: {
        ...merged.options,
        ...config.options,
        polling: { ...merged.options?.polling, ...config.options?.polling },
        session: { ...merged.options?.session, ...config.options?.session },
        api: { ...merged.options?.api, ...config.options?.api },
        logging: { ...merged.options?.logging, ...config.options?.logging },
        webhook: { ...merged.options?.webhook, ...config.options?.webhook } as any,
        claude: { ...merged.options?.claude, ...config.options?.claude },
      },
    } as Partial<PluginConfig>;
  }, {} as Partial<PluginConfig>);
}
