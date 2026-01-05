/**
 * Agent Commands
 * Commando's voor interactie met OpenCode agents
 */

import type { Message, CallbackQuery } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { BotCallbackHandler, type CallbackHandler } from '../handlers/callback';
import { BotCallbackHandler as CallbackHandlerClass } from '../handlers/callback';

// =============================================================================
// Agent List Command
// =============================================================================

export async function agentListCommand(
  api: ApiMethods,
  message: Message,
  agents: Array<{ name: string; id: string; status: string }>
): Promise<void> {
  const chatId = message.chat.id;

  if (agents.length === 0) {
    await api.sendText(chatId, 'Geen agents gevonden.');
    return;
  }

  let agentText = '*Beschikbare Agents:*\n\n';

  for (const agent of agents) {
    const statusEmoji = agent.status === 'online' ? '🟢' : '🔴';
    agentText += `${statusEmoji} *${agent.name}*\n`;
  }

  await api.sendText(chatId, agentText, {
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Agent Call Command
// =============================================================================

export async function agentCallCommand(
  api: ApiMethods,
  message: Message,
  agentName: string
): Promise<void> {
  const chatId = message.chat.id;

  // TODO: Implement actual agent call

  const keyboard = api.createInlineKeyboard([
    [{ text: '✓ Bevestig', callback_data: `agent:confirm:${agentName}` }],
    [{ text: '✗ Annuleer', callback_data: 'agent:cancel' }],
  ]);

  await api.sendWithKeyboard(
    chatId,
    `Wil je agent *${agentName}* aanroepen?`,
    keyboard,
    { parse_mode: 'Markdown' }
  );
}

// =============================================================================
// Agent Callback Handlers
// =============================================================================

export function registerAgentCallbacks(
  callbackHandler: CallbackHandler
): void {
  // Confirm agent call
  callbackHandler.registerCallback('agent:confirm:', async (callbackQuery) => {
    const { params } = CallbackHandlerClass.parseData(callbackQuery.data || '');

    if (callbackHandler instanceof BotCallbackHandler) {
      await callbackHandler.answerCallback(callbackQuery, `Agent ${params[0]} aangeroepen!`);
      await callbackHandler.editMessage(callbackQuery, `Agent *${params[0]}* wordt aangeroepen...`);
    }
  });

  // Cancel agent call
  callbackHandler.registerCallback('agent:cancel', async (callbackQuery) => {
    if (callbackHandler instanceof BotCallbackHandler) {
      await callbackHandler.answerCallback(callbackQuery, 'Geannuleerd');
      await callbackHandler.editMessage(callbackQuery, 'Agent aanroep geannuleerd.');
    }
  });
}

// =============================================================================
// Agent Message Handler
// =============================================================================

export async function forwardToAgent(
  api: ApiMethods,
  message: Message,
  agentId: string
): Promise<void> {
  const chatId = message.chat.id;

  // TODO: Implement actual message forwarding to agent

  await api.sendText(
    chatId,
    `Bericht doorgestuurd naar agent. Wacht op antwoord...`
  );
}
