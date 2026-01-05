/**
 * LLM Provider Commands
 * Manage active LLM provider per chat
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import type { LLMRouter } from '../../llm';

export async function llmCommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  router: LLMRouter
): Promise<void> {
  const chatId = message.chat.id;
  const subcommand = args[0]?.toLowerCase();

  if (!subcommand || subcommand === 'status') {
    const current = router.getProvider(String(chatId));
    const defaultProvider = router.getDefaultProvider();
    const currentModel = router.getModel(String(chatId), current);
    const currentDevModel = router.getDeveloperModel(String(chatId), current);
    const providers = router.getProviderStatus();

    const lines = providers.map((provider) => {
      const status = provider.available ? '✅' : '❌';
      const note = provider.reason ? ` (${provider.reason})` : '';
      const override = router.getModelOverride(String(chatId), provider.provider);
      const model = router.getModel(String(chatId), provider.provider);
      const modelText = model ? ` — ${model}${override ? ' (override)' : ''}` : '';
      return `${status} ${provider.label}${note}${modelText}`;
    });

    const text = `🤖 *LLM Provider Status*

*Huidig:* ${router.getProviderLabel(current)}
*Default:* ${router.getProviderLabel(defaultProvider)}
*Model:* ${currentModel || 'n.v.t.'}
*Dev model:* ${currentDevModel || 'n.v.t.'}

*Beschikbaar:*
${lines.join('\n')}

Gebruik:
/llm set <provider>
/llm model set [provider] <model>
/llm model reset [provider]
/llm reset
/llm list

Voorbeelden:
/llm set mistral
/llm model set mistral mistral-small-latest
/llm model set codestral-latest
`;

    await api.sendMessage({ chat_id: chatId, text, parse_mode: 'Markdown' });
    return;
  }

  if (subcommand === 'list') {
    const providers = router.getProviderStatus();
    const lines = providers.map((provider) => {
      const status = provider.available ? '✅' : '❌';
      const note = provider.reason ? ` (${provider.reason})` : '';
      const model = router.getModel(String(chatId), provider.provider);
      const modelText = model ? ` — ${model}` : '';
      return `${status} ${provider.label}${note}${modelText}`;
    });

    await api.sendMessage({
      chat_id: chatId,
      text: `*LLM Providers*\n${lines.join('\n')}`,
      parse_mode: 'Markdown',
    });
    return;
  }

  if (subcommand === 'reset' || subcommand === 'default') {
    router.clearProvider(String(chatId));
    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Provider teruggezet naar default: ${router.getProviderLabel(router.getDefaultProvider())}`,
    });
    return;
  }

  if (subcommand === 'model') {
    const action = args[1]?.toLowerCase();
    const currentProvider = router.getProvider(String(chatId));

    if (!action || action === 'status') {
      const model = router.getModel(String(chatId), currentProvider);
      await api.sendMessage({
        chat_id: chatId,
        text: `🤖 *Model Status*\n\nProvider: ${router.getProviderLabel(currentProvider)}\nModel: ${model || 'n.v.t.'}`,
        parse_mode: 'Markdown',
      });
      return;
    }

    if (action === 'reset' || action === 'default') {
      const providerArg = args[2];
      const provider = providerArg ? router.normalizeProvider(providerArg) : currentProvider;
      if (!provider) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Onbekende provider voor model reset.',
        });
        return;
      }
      router.clearModel(String(chatId), provider);
      const model = router.getModel(String(chatId), provider);
      await api.sendMessage({
        chat_id: chatId,
        text: `✅ Model reset voor ${router.getProviderLabel(provider)}: ${model || 'n.v.t.'}`,
      });
      return;
    }

    if (action === 'set') {
      const possibleProvider = args[2];
      const possibleModel = args.slice(3).join(' ').trim();
      let provider = currentProvider;
      let model = '';

      if (possibleProvider && possibleModel) {
        const normalized = router.normalizeProvider(possibleProvider);
        if (normalized) {
          provider = normalized;
          model = possibleModel;
        } else {
          model = args.slice(2).join(' ').trim();
        }
      } else {
        model = args.slice(2).join(' ').trim();
      }

    if (!model) {
      await api.sendMessage({
        chat_id: chatId,
        text: '❌ Gebruik: /llm model set [provider] <model>',
      });
      return;
    }

    if (provider === 'claude-cli') {
      await api.sendMessage({
        chat_id: chatId,
        text: '⚠️ Claude CLI gebruikt geen model via de bot. Gebruik een API-provider voor modelkeuze.',
      });
      return;
    }

      if (!router.isProviderAvailable(provider)) {
        await api.sendMessage({
          chat_id: chatId,
          text: `⚠️ ${router.getProviderLabel(provider)} is niet geconfigureerd.`,
        });
        return;
      }

      router.setModel(String(chatId), provider, model);
      await api.sendMessage({
        chat_id: chatId,
        text: `✅ Model ingesteld voor ${router.getProviderLabel(provider)}: ${model}`,
      });
      return;
    }

    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Gebruik: /llm model set [provider] <model> | /llm model reset',
    });
    return;
  }

  const providerInput = subcommand === 'set' ? args[1] : subcommand;
  if (!providerInput) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Gebruik: /llm set <zai|minimax|mistral|claude-cli>',
    });
    return;
  }

  const provider = router.normalizeProvider(providerInput);
  if (!provider) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Onbekende provider. Gebruik: zai, minimax, mistral, claude-cli',
    });
    return;
  }

  if (!router.isProviderAvailable(provider)) {
    await api.sendMessage({
      chat_id: chatId,
      text: `⚠️ ${router.getProviderLabel(provider)} is niet geconfigureerd.`,
    });
    return;
  }

  router.setProvider(String(chatId), provider);
  const note = provider === 'claude-cli'
    ? '\nℹ️ Claude CLI vereist lokale installatie en login.'
    : '';

  await api.sendMessage({
    chat_id: chatId,
    text: `✅ Provider ingesteld op ${router.getProviderLabel(provider)}.${note}`,
  });
}
