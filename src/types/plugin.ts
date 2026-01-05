/**
 * Plugin Configuration Types
 * Types voor plugin configuratie en opties
 */

// =============================================================================
// Plugin Configuration
// =============================================================================

export interface PluginConfig {
  /** Telegram Bot token */
  botToken: string;
  /** Anthropic API key for Claude integration (deprecated, use zaiApiKey) */
  anthropicApiKey?: string;
  /** Z.ai API key for GLM-4.7 integration */
  zaiApiKey?: string;
  /** MiniMax API key for MiniMax v2.1 integration */
  miniMaxApiKey?: string;
  /** Plugin opties */
  options?: PluginOptions;
}

export interface PluginOptions {
  /** Polling opties */
  polling?: PollingOptions;
  /** Sessie opties */
  session?: SessionPluginOptions;
  /** API opties */
  api?: ApiOptions;
  /** Logging opties */
  logging?: LoggingOptions;
  /** Webhook opties (alternatief voor polling) */
  webhook?: WebhookOptions;
  /** Claude AI opties */
  claude?: ClaudeOptions;
}

// =============================================================================
// Claude Options
// =============================================================================

export interface ClaudeOptions {
  /** Model to use (default: claude-3-5-sonnet-20241022) */
  model?: string;
  /** Maximum tokens in response (default: 4096) */
  maxTokens?: number;
  /** Temperature for randomness (default: 0.7) */
  temperature?: number;
  /** Maximum history messages per conversation (default: 50) */
  maxHistoryMessages?: number;
}

// =============================================================================
// Polling Options
// =============================================================================

export interface PollingOptions {
  /** Polling interval in ms (default: 300) */
  interval?: number;
  /** Auto-start polling (default: true) */
  autoStart?: boolean;
  /** Stop polling op error (default: true) */
  stopOnError?: boolean;
  /** Max retries bij error */
  maxRetries?: number;
  /** Request timeout in ms */
  timeout?: number;
}

// =============================================================================
// Session Plugin Options
// =============================================================================

export interface SessionPluginOptions {
  /** Sessie TTL in seconden (0 = oneindig) */
  ttl?: number;
  /** Maximum aantal sessies */
  maxSessions?: number;
  /** Storage type */
  storage?: 'memory' | 'redis' | 'database';
  /** Cleanup interval in ms */
  cleanupInterval?: number;
  /** Redis opties (als storage = 'redis') */
  redis?: {
    url: string;
    keyPrefix?: string;
  };
  /** Database opties (als storage = 'database') */
  database?: {
    connectionString: string;
    tableName?: string;
  };
}

// =============================================================================
// API Options
// =============================================================================

export interface ApiOptions {
  /** Telegram API base URL (default: https://api.telegram.org) */
  baseUrl?: string;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Max retries bij failure (default: 3) */
  maxRetries?: number;
  /** Retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Axios instance options */
  axiosOptions?: Record<string, unknown>;
}

// =============================================================================
// Logging Options
// =============================================================================

export interface LoggingOptions {
  /** Log level */
  level?: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  /** Log format */
  format?: 'json' | 'text';
  /** Log naar console */
  console?: boolean;
  /** Log naar bestand */
  file?: {
    path: string;
    maxSize?: string;
    maxFiles?: number;
  };
  /** Custom logger function */
  logger?: (level: string, message: string, meta?: Record<string, unknown>) => void;
}

// =============================================================================
// Webhook Options
// =============================================================================

export interface WebhookOptions {
  /** Webhook URL */
  url: string;
  /** Webhook port (default: 3000) */
  port?: number;
  /** Webhook host (default: 0.0.0.0) */
  host?: string;
  /** Webhook path (default: /telegram-webhook) */
  path?: string;
  /** TLS options */
  tls?: {
    key: string;
    cert: string;
    ca?: string;
  };
  /** Health check path */
  healthCheck?: {
    path?: string;
    enabled?: boolean;
  };
}

// =============================================================================
// Plugin State
// =============================================================================

export interface PluginState {
  /** Is plugin gestart */
  isStarted: boolean;
  /** Is polling actief */
  isPolling: boolean;
  /** Aantal actieve sessies */
  sessionCount: number;
  /** Start timestamp */
  startedAt?: Date;
  /** Laatste update timestamp */
  lastUpdateAt?: Date;
  /** Statistieken */
  stats: PluginStats;
}

// =============================================================================
// Plugin Statistics
// =============================================================================

export interface PluginStats {
  /** Totaal aantal verwerkte updates */
  totalUpdates: number;
  /** Totaal aantal verwerkte berichten */
  totalMessages: number;
  /** Totaal aantal verwerkte commando's */
  totalCommands: number;
  /** Totaal aantal API calls */
  totalApiCalls: number;
  /** Aantal errors */
  totalErrors: number;
  /** Laatste reset timestamp */
  lastResetAt: Date;
}

// =============================================================================
// Plugin Status
// =============================================================================

export interface PluginStatus {
  /** Plugin status */
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  /** State */
  state: PluginState;
  /** Foutmelding (indien error status) */
  error?: string;
}

// =============================================================================
// OpenCode Integration Types
// =============================================================================

export interface OpenCodeEvent {
  /** Event type */
  type: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Timestamp */
  timestamp: Date;
}

export interface OpenCodeAgent {
  /** Agent naam */
  name: string;
  /** Agent ID */
  id: string;
  /** Agent status */
  status: 'online' | 'offline' | 'busy';
}

export interface OpenCodeMessage {
  /** Afzender */
  from: string;
  /** Ontvanger */
  to: string;
  /** Bericht content */
  content: string;
  /** Timestamp */
  timestamp: Date;
  /** Bericht ID */
  id: string;
}
