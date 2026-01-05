/**
 * Streaming Message Handler
 * Handler voor streaming berichten met Claude Code integratie
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { createLogger } from '../../utils/logger';
import type { ClaudeCodeService } from '../../claude-code/service';
import { StreamStatus, type ToolUseEvent, type ToolResultEvent, getErrorSuggestions } from '../../streaming/types';
import { MessageStreamer } from '../../streaming/message-stream';
import { getStatusManager } from '../../streaming/status';
import { getToolVisibilityManager } from '../../streaming/tool-visibility';
import { getConfirmationManager } from '../../streaming/confirmation';
import type { MessageHandler } from './message';

const logger = createLogger({ prefix: 'StreamingHandler' });

// =============================================================================
// Streaming Message Handler
// =============================================================================

export class StreamingMessageHandler implements MessageHandler {
  private messageStreamer: MessageStreamer;
  private statusManager = getStatusManager();
  private toolVisibility = getToolVisibilityManager();
  private confirmationManager: ReturnType<typeof getConfirmationManager>;

  constructor(
    private api: ApiMethods,
    private claudeCode: ClaudeCodeService
  ) {
    this.messageStreamer = new MessageStreamer(api);
    this.confirmationManager = getConfirmationManager(api);
  }

  async handle(message: Message): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';

    if (!text || text.startsWith('/')) {
      // Skip commands (handled by command handler)
      return;
    }

    logger.debug('Handling streaming message', { chatId, textLength: text.length });

    try {
      // Create stream state
      this.statusManager.createState(String(chatId));

      // Send initial status
      await this.api.sendChatAction({ chat_id: chatId, action: 'typing' });

      // Get session info
      const session = await this.claudeCode.getActiveSession(String(chatId));
      const sessionInfo = session ? '\n\n📁 *Session:* `' + session.id.substring(0, 8) + '...`' : '';

      const initialStatus = '🤖 *Claude Code*' + sessionInfo + '\n\n' + this.statusManager.generateStatusDisplay(String(chatId));
      const statusResult = await this.api.sendMessage({
        chat_id: chatId,
        text: initialStatus,
        parse_mode: 'Markdown',
      });

      const statusMessageId = statusResult.message_id;
      this.statusManager.setMessageId(String(chatId), statusMessageId);

      // Process message with streaming callbacks
      let accumulatedContent = '';

      await this.claudeCode.processMessageStream(String(chatId), text, {
        onStatusChange: async (status: StreamStatus) => {
          this.statusManager.updateStatus(String(chatId), status);
          await this.updateStatusMessage(chatId, statusMessageId);
        },

        onToolUse: async (tool: ToolUseEvent) => {
          logger.debug('Tool use detected', { tool: tool.name });

          // Check if confirmation required
          if (this.confirmationManager.requiresConfirmation(tool)) {
            logger.debug('Confirmation required for tool', { tool: tool.name });

            // Pause streaming state
            this.statusManager.updateStatus(String(chatId), StreamStatus.CONFIRMATION);
            this.statusManager.setCurrentTool(String(chatId), tool.name);

            // Request user confirmation
            const approved = await this.confirmationManager.requestConfirmation(tool, chatId);

            if (!approved) {
              // User rejected - terminate the stream
              logger.debug('User rejected tool use', { tool: tool.name });
              this.statusManager.updateStatus(String(chatId), StreamStatus.ERROR, 'Operation rejected by user');
              await this.updateStatusMessage(chatId, statusMessageId);

              // Send cancellation message
              await this.api.sendMessage({
                chat_id: chatId,
                text: '❌ Operation cancelled',
              });

              this.statusManager.clearState(String(chatId));
              throw new Error('Operation rejected by user');
            }

            // User approved - continue
            logger.debug('User approved tool use', { tool: tool.name });
          }

          this.statusManager.setCurrentTool(String(chatId), tool.name);
          this.statusManager.addToolToHistory(String(chatId), tool);

          // Update status message with tool info
          const toolDisplay = this.toolVisibility.formatToolUse(tool);
          const currentText = this.statusManager.generateStatusDisplay(String(chatId));

          await this.api.editMessageText({
            chat_id: chatId,
            message_id: statusMessageId,
            text: currentText + '\n\n' + toolDisplay,
            parse_mode: 'Markdown',
          });
        },

        onToolResult: async (result: ToolResultEvent) => {
          logger.debug('Tool result received', { toolId: result.toolUseId, contentLength: result.content.length });

          const state = this.statusManager.getState(String(chatId));
          const currentTool = state?.currentTool || 'unknown';

          // Format and display tool result inline in status message
          const toolResultDisplay = this.toolVisibility.formatToolResult(result, currentTool);
          const currentText = this.statusManager.generateStatusDisplay(String(chatId));

          await this.api.editMessageText({
            chat_id: chatId,
            message_id: statusMessageId,
            text: currentText + '\n\n' + toolResultDisplay,
            parse_mode: 'Markdown',
          });

          this.statusManager.setCurrentTool(String(chatId), '');
        },

        onContent: async (chunk: string) => {
          accumulatedContent += chunk;

          // Update message with accumulated content (throttled)
          await this.messageStreamer.editMessageThrottled(
            chatId,
            statusMessageId,
            accumulatedContent || this.statusManager.generateStatusDisplay(String(chatId)),
            {
              maxLength: 3800,
              parseMode: 'Markdown',
              throttleMs: 500,
            }
          );
        },

        onError: async (error: Error) => {
          logger.error('Stream error', { error, chatId });
          this.statusManager.updateStatus(String(chatId), StreamStatus.ERROR, error.message);
          await this.updateStatusMessage(chatId, statusMessageId);

          const suggestions = getErrorSuggestions(error.message);
          let errorText = '❌ *Error*\n\n' + error.message + '\n\n';
          if (suggestions.length > 0) {
            errorText += '💡 *Suggestions:*\n' + suggestions.map(s => '• ' + s).join('\n');
          }

          await this.api.sendMessage({
            chat_id: chatId,
            text: errorText,
            parse_mode: 'Markdown',
          });
        },

        onComplete: async (result) => {
          logger.debug('Stream complete', { chatId, textLength: result.text.length });

          this.statusManager.updateStatus(String(chatId), StreamStatus.COMPLETE);
          await this.updateStatusMessage(chatId, statusMessageId);

          this.statusManager.clearState(String(chatId));
        },
      });

    } catch (error) {
      logger.error('Error handling streaming message', { error, chatId });

      const errorMessage = error instanceof Error ? error.message : 'Onbekende fout';
      const suggestions = getErrorSuggestions(errorMessage);

      // Send error message with suggestions
      await this.api.sendMessage({
        chat_id: chatId,
        text: `❌ *Error:*\n${errorMessage}\n\n💡 *Suggestions:*\n${suggestions.map(s => s).join('\n')}`,
        parse_mode: 'Markdown',
      });

      // Clean up
      this.statusManager.clearState(String(chatId));
      this.messageStreamer.cleanup(chatId);
    }
  }

  /**
   * Update status message with current status display
   */
  private async updateStatusMessage(chatId: number, messageId: number): Promise<void> {
    try {
      const statusText = this.statusManager.generateStatusDisplay(String(chatId));

      await this.api.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: statusText,
        parse_mode: 'Markdown',
      });
    } catch (error) {
      // Log but don't throw - transient errors are ok
      logger.warn('Failed to update status message', { error, chatId, messageId });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.messageStreamer.destroy();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createStreamingMessageHandler(
  api: ApiMethods,
  claudeCode: ClaudeCodeService
): StreamingMessageHandler {
  return new StreamingMessageHandler(api, claudeCode);
}
