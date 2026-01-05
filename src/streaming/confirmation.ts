/**
 * Confirmation Manager
 * Beheert interactieve bevestigingen voor gevaarlijke operaties
 */

import type { ApiMethods } from '../api/methods';
import type { ToolUseEvent } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'Confirmation' });

// =============================================================================
// Dangerous Tool Detection
// =============================================================================

const DANGEROUS_TOOLS = new Set(['Write', 'write', 'Edit', 'edit', 'Delete', 'delete']);

const DANGEROUS_COMMANDS = [
  'rm -rf',
  'rm -r',
  'del ',
  'delete',
  'format',
  'mkfs',
  'dd if=',
  'git push --force',
  'git reset --hard',
  'chmod 000',
  '> /dev/',
];

// =============================================================================
// Confirmation State
// =============================================================================

interface PendingConfirmation {
  id: string;
  chatId: number;
  tool: ToolUseEvent;
  messageId: number;
  createdAt: Date;
  resolve: (approved: boolean) => void;
  timeout?: NodeJS.Timeout;
}

// =============================================================================
// Confirmation Manager
// =============================================================================

export class ConfirmationManager {
  private pendingConfirmations = new Map<string, PendingConfirmation>();

  constructor(private api: ApiMethods) {}

  /**
   * Check if tool requires confirmation
   */
  requiresConfirmation(tool: ToolUseEvent): boolean {
    // Check if tool is inherently dangerous
    if (DANGEROUS_TOOLS.has(tool.name)) {
      return true;
    }

    // Check bash commands for dangerous patterns
    if (tool.name === 'Bash' || tool.name === 'bash') {
      const command = (tool.input as Record<string, unknown>).command as string;
      if (command && this.isDangerousCommand(command)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if command is dangerous
   */
  private isDangerousCommand(command: string): boolean {
    const lowerCommand = command.toLowerCase();
    return DANGEROUS_COMMANDS.some(pattern => lowerCommand.includes(pattern));
  }

  /**
   * Request user confirmation
   */
  async requestConfirmation(tool: ToolUseEvent, chatId: number): Promise<boolean> {
    const confirmationId = `conf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    logger.debug('Requesting confirmation', { tool: tool.name, confirmationId, chatId });

    return new Promise((resolve) => {
      // Format confirmation message
      const message = this.formatConfirmationMessage(tool);

      // Create inline keyboard
      const keyboard = {
        inline_keyboard: [
          [
            { text: '✅ Approve', callback_data: `${confirmationId}:approve` },
            { text: '❌ Reject', callback_data: `${confirmationId}:reject` },
          ],
        ],
      };

      // Send confirmation request
      this.api.sendMessage({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }).then((result) => {
        // Store pending confirmation
        const pending: PendingConfirmation = {
          id: confirmationId,
          chatId,
          tool,
          messageId: result.message_id,
          createdAt: new Date(),
          resolve,
          timeout: setTimeout(() => {
            // Auto-reject after 5 minutes
            logger.debug('Confirmation timeout', { confirmationId });
            this.cleanup(confirmationId);
            resolve(false);
          }, 5 * 60 * 1000),
        };

        this.pendingConfirmations.set(confirmationId, pending);
      }).catch((error) => {
        logger.error('Failed to send confirmation', { error });
        resolve(false);
      });
    });
  }

  /**
   * Handle callback response
   */
  async handleCallback(callbackData: string): Promise<boolean> {
    const [confirmationId, decision] = callbackData.split(':');

    const pending = this.pendingConfirmations.get(confirmationId);
    if (!pending) {
      logger.warn('Unknown confirmation ID', { confirmationId });
      return false;
    }

    // Answer callback query
    await this.api.answerCallbackQuery({
      callback_query_id: callbackData, // This would need the actual callback_query_id
      text: decision === 'approve' ? '✅ Approved' : '❌ Rejected',
    });

    const approved = decision === 'approve';

    // Resolve the promise
    pending.resolve(approved);

    // Delete confirmation message
    try {
      await this.api.deleteMessage(pending.chatId, pending.messageId);
    } catch {
      // Message might already be deleted
    }

    // Cleanup
    this.cleanup(confirmationId);

    return approved;
  }

  /**
   * Format confirmation message
   */
  private formatConfirmationMessage(tool: ToolUseEvent): string {
    let message = '⚠️ *Confirmation Required*\n\n';
    message += `Claude wants to execute:\n\n`;

    if (tool.name === 'Bash' || tool.name === 'bash') {
      const command = (tool.input as Record<string, unknown>).command as string;
      message += `\`\`\`\n${command}\n\`\`\`\n`;
    } else if (tool.name === 'Write' || tool.name === 'write') {
      const filePath = (tool.input as Record<string, unknown>).file_path as string;
      const content = (tool.input as Record<string, unknown>).content as string;
      message += `File: \`${filePath}\`\n`;
      message += `Action: Write ${content.length} bytes\n`;
    } else if (tool.name === 'Edit' || tool.name === 'edit') {
      const filePath = (tool.input as Record<string, unknown>).file_path as string;
      message += `File: \`${filePath}\`\n`;
      message += `Action: Edit file\n`;
    } else {
      message += `Tool: ${tool.name}\n`;
      message += `Input: ${JSON.stringify(tool.input, null, 2)}\n`;
    }

    message += `\n⚠️ This action could be destructive. Approve?`;

    return message;
  }

  /**
   * Cleanup pending confirmation
   */
  private cleanup(confirmationId: string): void {
    const pending = this.pendingConfirmations.get(confirmationId);
    if (pending) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
      this.pendingConfirmations.delete(confirmationId);
    }
  }

  /**
   * Get pending confirmation by ID
   */
  getPendingConfirmation(confirmationId: string): PendingConfirmation | undefined {
    return this.pendingConfirmations.get(confirmationId);
  }

  /**
   * Cleanup expired confirmations
   */
  cleanupExpired(): number {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    let cleaned = 0;

    for (const [id, pending] of this.pendingConfirmations.entries()) {
      if (pending.createdAt.getTime() < fiveMinutesAgo) {
        this.cleanup(id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Destroy all pending confirmations
   */
  destroy(): void {
    for (const [id, pending] of this.pendingConfirmations.entries()) {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
    }
    this.pendingConfirmations.clear();
  }
}

// =============================================================================
// Factory
// =============================================================================

let defaultManager: ConfirmationManager | null = null;

export function getConfirmationManager(api: ApiMethods): ConfirmationManager {
  if (!defaultManager) {
    defaultManager = new ConfirmationManager(api);
  }
  return defaultManager;
}

export function resetConfirmationManager(): void {
  if (defaultManager) {
    defaultManager.destroy();
  }
  defaultManager = null;
}
