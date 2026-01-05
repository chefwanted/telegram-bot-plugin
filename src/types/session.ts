/**
 * Session Management Types
 * Types voor sessiebeheer en opslag
 */

// =============================================================================
// Core Session Types
// =============================================================================

export interface Session {
  /** Unieke sessie identifier */
  id: string;
  /** Telegram user ID */
  userId: number;
  /** Telegram chat ID */
  chatId: number;
  /** Sessie data */
  data: SessionData;
  /** Creatie timestamp */
  createdAt: Date;
  /** Laatste update timestamp */
  updatedAt: Date;
  /** Sessie vervaltijd (optionele TTL) */
  expiresAt?: Date;
}

export interface SessionData {
  /** Huidige context van de sessie */
  context?: Record<string, unknown>;
  /** Laatst uitgevoerde commando */
  lastCommand?: string;
  /** Agent gerelateerde state */
  agentState?: AgentState;
  /** User specifieke preferences */
  preferences?: UserPreferences;
  /** Tijdelijke data voor huidige interactie */
  temporary?: Record<string, unknown>;
  /** Streaming state for interactive responses */
  streamingState?: StreamingState;
}

// =============================================================================
// Streaming State
// =============================================================================

export interface StreamingState {
  /** Current streaming status */
  status: 'idle' | 'thinking' | 'tool_use' | 'response' | 'confirmation' | 'complete' | 'error';
  /** Current message ID being edited */
  currentMessageId?: number;
  /** Current tool being used */
  currentTool?: string;
  /** Pending confirmation action ID */
  pendingConfirmation?: string;
  /** History of tools used in current session */
  toolHistory: ToolUseHistoryItem[];
}

export interface ToolUseHistoryItem {
  /** Tool name */
  name: string;
  /** Tool input */
  input: Record<string, unknown>;
  /** Timestamp when tool was used */
  timestamp: Date;
}

// =============================================================================
// Agent State Types
// =============================================================================

export interface AgentState {
  /** Huidige agent waarmee interactie is */
  currentAgent?: string;
  /** Status van de agent */
  status: 'idle' | 'busy' | 'waiting_for_input';
  /** Wachtrij van berichten naar de agent */
  messageQueue: QueuedMessage[];
  /** Laatste interactie timestamp */
  lastInteractionAt: Date;
}

export interface QueuedMessage {
  /** Bericht ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Bericht content */
  content: string;
  /** Of dit bericht al verwerkt is */
  processed: boolean;
}

// =============================================================================
// User Preferences
// =============================================================================

export interface UserPreferences {
  /** Voorkeurstaal */
  language?: 'nl' | 'en';
  /** Notificaties aan/uit */
  notifications?: boolean;
  /** Tijdzone */
  timezone?: string;
  /** Andere preferences */
  custom?: Record<string, unknown>;
}

// =============================================================================
// Session Options
// =============================================================================

export interface SessionOptions {
  /** Time-to-live in seconden (0 = oneindig) */
  ttl?: number;
  /** Maximum aantal sessies */
  maxSessions?: number;
  /** Opslag strategie */
  storage?: 'memory' | 'redis' | 'database';
  /** Cleanup interval in milliseconden */
  cleanupInterval?: number;
}

// =============================================================================
// Storage Interface
// =============================================================================

export interface Storage {
  /** Haal sessie op op basis van ID */
  get(id: string): Promise<Session | null>;
  /** Sla sessie op */
  set(session: Session): Promise<void>;
  /** Verwijder sessie */
  delete(id: string): Promise<boolean>;
  /** Check of sessie bestaat */
  has(id: string): Promise<boolean>;
  /** Haal alle sessies op */
  getAll(): Promise<Session[]>;
  /** Verwijder alle sessies */
  clear(): Promise<void>;
  /** Haal sessie op basis van user ID */
  getByUserId(userId: number): Promise<Session[]>;
  /** Haal sessie op basis van chat ID */
  getByChatId(chatId: number): Promise<Session[]>;
}

// =============================================================================
// Session Manager Interface
// =============================================================================

export interface SessionManager {
  /** Creëer nieuwe sessie */
  create(userId: number, chatId: number, options?: SessionOptions): Promise<Session>;
  /** Haal sessie op */
  get(id: string): Promise<Session | null>;
  /** Update sessie data */
  update(id: string, data: Partial<SessionData>): Promise<Session>;
  /** Verwijder sessie */
  delete(id: string): Promise<boolean>;
  /** Haal of creëer sessie */
  getOrCreate(userId: number, chatId: number, options?: SessionOptions): Promise<Session>;
  /** Cleanup vervallen sessies */
  cleanup(): Promise<number>;
  /** Get aantal actieve sessies */
  count(): Promise<number>;
  /** Cleanup en stop */
  destroy(): void;
}

// =============================================================================
// Storage Implementation Options
// =============================================================================

export interface MemoryStorageOptions {
  /** Maximum aantal sessies in geheugen */
  maxSize?: number;
  /** Cleanup interval in ms */
  cleanupInterval?: number;
}

export interface RedisStorageOptions {
  /** Redis connection string */
  url: string;
  /** Key prefix voor sessies */
  keyPrefix?: string;
  /** Default TTL in seconden */
  ttl?: number;
}

export interface DatabaseStorageOptions {
  /** Tabel naam */
  tableName?: string;
  /** Default TTL in seconden (default: 86400 = 24 uur) */
  ttl?: number;
}
