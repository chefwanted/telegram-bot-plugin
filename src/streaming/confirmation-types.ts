/**
 * Confirmation Types
 * Types voor interactieve bevestigingen
 */

import type { ToolUseEvent } from './types';

// =============================================================================
// Confirmation Types
// =============================================================================

export interface ConfirmationRequest {
  id: string;
  chatId: number;
  tool: ToolUseEvent;
  messageId: number;
  createdAt: Date;
}

export interface ConfirmationResponse {
  approved: boolean;
  confirmationId: string;
  userId?: number;
}

export interface ConfirmationOptions {
  timeout?: number;  // Auto-reject timeout in ms (default: 5 minutes)
  destructive?: boolean;  // Whether this is a destructive operation
}

// =============================================================================
// Dangerous Tool Patterns
// =============================================================================

export interface DangerousToolPattern {
  tool: string;
  pattern?: RegExp;  // For bash commands
  reason: string;
}

export const DANGEROUS_PATTERNS: DangerousToolPattern[] = [
  {
    tool: 'Write',
    reason: 'File modification - will overwrite existing content',
  },
  {
    tool: 'Edit',
    reason: 'File editing - will modify file content',
  },
  {
    tool: 'Bash',
    pattern: /rm\s+-rf/i,
    reason: 'Recursive delete - will permanently delete files',
  },
  {
    tool: 'Bash',
    pattern: /rm\s+-r/i,
    reason: 'Directory deletion - will delete directory',
  },
  {
    tool: 'Bash',
    pattern: /dd\s+if=/i,
    reason: 'Disk write - will overwrite disk data',
  },
  {
    tool: 'Bash',
    pattern: /git\s+push\s+--force/i,
    reason: 'Force push - will rewrite remote history',
  },
  {
    tool: 'Bash',
    pattern: /git\s+reset\s+--hard/i,
    reason: 'Hard reset - will discard local changes',
  },
  {
    tool: 'Bash',
    pattern: /chmod\s+000/i,
    reason: 'Remove permissions - will make files inaccessible',
  },
];
