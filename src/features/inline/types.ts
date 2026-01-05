/**
 * Inline Mode Types
 * Inline queries for using the bot in any chat
 */

import type { InlineQuery } from '../../types/telegram';
import type { InlineQueryResult } from '../../api/types';

// =============================================================================
// Types
// =============================================================================

export interface InlineContext {
  query: string;
  userId: number;
}

export interface InlineHandler {
  pattern: RegExp;
  handler: (context: InlineContext) => InlineQueryResult[] | Promise<InlineQueryResult[]>;
  description: string;
}

export interface InlineResponse {
  results: InlineQueryResult[];
  cache_time?: number;
  is_personal?: boolean;
}

// =============================================================================
// Inline Query Types
// =============================================================================

export type InlineQueryType =
  | 'weather'
  | 'translate'
  | 'calculator'
  | 'note'
  | 'define'
  | 'unknown';

export interface ParsedInlineQuery {
  type: InlineQueryType;
  params: Record<string, string>;
}
