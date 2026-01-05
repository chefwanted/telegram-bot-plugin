/**
 * LLM Router
 * Routes chat messages to the selected provider with fallback support.
 */

import type { ClaudeCodeService } from '../claude-code';
import type { ZAIService } from '../zai';
import type { MiniMaxService } from '../minimax';
import type { MistralService } from '../mistral';
import type { ClaudeCodeStreamCallbacks, StreamingResult } from '../streaming/types';
import { StreamStatus } from '../streaming/types';
import type { LLMProvider, LLMProviderStatus, LLMMessageResult } from './types';
import { createLogger } from '../utils/logger';

const logger = createLogger({ prefix: 'LLMRouter' });

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  'zai': 'Z.ai GLM-4.7',
  'minimax': 'MiniMax v2.1',
  'mistral': 'Mistral',
  'claude-cli': 'Claude CLI',
};

const PROVIDER_ALIASES: Record<string, LLMProvider> = {
  'zai': 'zai',
  'glm': 'zai',
  'glm-4.7': 'zai',
  'minimax': 'minimax',
  'minimax-v2.1': 'minimax',
  'mistral': 'mistral',
  'mixtral': 'mistral',
  'claude': 'claude-cli',
  'claude-cli': 'claude-cli',
  'cli': 'claude-cli',
};

const DEFAULT_FALLBACK_ORDER: LLMProvider[] = ['zai', 'minimax', 'mistral'];

export class LLMRouter {
  private providerOverrides = new Map<string, LLMProvider>();
  private modelOverrides = new Map<string, Partial<Record<LLMProvider, string>>>();
  private defaultProvider: LLMProvider;
  private fallbackOrder: LLMProvider[];
  private devDefaultModels: Partial<Record<LLMProvider, string>>;

  constructor(
    private services: {
      claude?: ClaudeCodeService;
      zai?: ZAIService;
      minimax?: MiniMaxService;
      mistral?: MistralService;
    },
    options: {
      defaultProvider: LLMProvider;
      fallbackOrder?: LLMProvider[];
      devModels?: Partial<Record<LLMProvider, string>>;
    }
  ) {
    this.defaultProvider = options.defaultProvider;
    this.fallbackOrder = options.fallbackOrder || DEFAULT_FALLBACK_ORDER;
    this.devDefaultModels = options.devModels || {};
  }

  normalizeProvider(input: string): LLMProvider | undefined {
    const key = input.trim().toLowerCase();
    return PROVIDER_ALIASES[key];
  }

  getProviderLabel(provider: LLMProvider): string {
    return PROVIDER_LABELS[provider] || provider;
  }

  getDefaultProvider(): LLMProvider {
    return this.defaultProvider;
  }

  getDefaultModel(provider: LLMProvider): string | undefined {
    switch (provider) {
      case 'zai':
        return this.services.zai?.getModel();
      case 'minimax':
        return this.services.minimax?.getModel();
      case 'mistral':
        return this.services.mistral?.getModel();
      case 'claude-cli':
        return undefined;
      default:
        return undefined;
    }
  }

  getModel(chatId: string, provider: LLMProvider): string | undefined {
    const override = this.modelOverrides.get(chatId)?.[provider];
    return override || this.getDefaultModel(provider);
  }

  getModelOverride(chatId: string, provider: LLMProvider): string | undefined {
    return this.modelOverrides.get(chatId)?.[provider];
  }

  getDeveloperModel(chatId: string, provider: LLMProvider): string | undefined {
    const override = this.modelOverrides.get(chatId)?.[provider];
    return override || this.devDefaultModels[provider] || this.getDefaultModel(provider);
  }

  getProvider(chatId: string): LLMProvider {
    const override = this.providerOverrides.get(chatId);
    const candidate = override || this.defaultProvider;
    if (this.isProviderAvailable(candidate)) {
      return candidate;
    }
    return this.getFallbackSequence(candidate)[0] || candidate;
  }

  isProviderActive(chatId: string, provider: LLMProvider): boolean {
    return this.getProvider(chatId) === provider;
  }

  setProvider(chatId: string, provider: LLMProvider): void {
    this.providerOverrides.set(chatId, provider);
  }

  clearProvider(chatId: string): void {
    this.providerOverrides.delete(chatId);
  }

  setModel(chatId: string, provider: LLMProvider, model: string): void {
    const existing = this.modelOverrides.get(chatId) || {};
    existing[provider] = model;
    this.modelOverrides.set(chatId, existing);
  }

  clearModel(chatId: string, provider?: LLMProvider): void {
    if (!provider) {
      this.modelOverrides.delete(chatId);
      return;
    }
    const existing = this.modelOverrides.get(chatId);
    if (!existing) return;
    delete existing[provider];
    if (Object.keys(existing).length === 0) {
      this.modelOverrides.delete(chatId);
    } else {
      this.modelOverrides.set(chatId, existing);
    }
  }

  getProviderStatus(): LLMProviderStatus[] {
    const providers: LLMProvider[] = ['zai', 'minimax', 'mistral', 'claude-cli'];
    return providers.map((provider) => ({
      provider,
      label: this.getProviderLabel(provider),
      available: this.isProviderAvailable(provider),
      reason: provider === 'claude-cli' ? 'Vereist lokaal geïnstalleerde Claude CLI' : undefined,
    }));
  }

  isProviderAvailable(provider: LLMProvider): boolean {
    switch (provider) {
      case 'zai':
        return !!this.services.zai;
      case 'minimax':
        return !!this.services.minimax;
      case 'mistral':
        return !!this.services.mistral;
      case 'claude-cli':
        return !!this.services.claude;
      default:
        return false;
    }
  }

  /**
   * Stream message via selected provider, with fallback to other providers.
   */
  async processMessageStream(
    chatId: string,
    message: string,
    callbacks: ClaudeCodeStreamCallbacks
  ): Promise<StreamingResult> {
    const provider = this.getProvider(chatId);
    const sequence = this.getFallbackSequence(provider);
    let lastError: Error | undefined;

    for (const candidate of sequence) {
      try {
        return await this.processWithProvider(candidate, chatId, message, callbacks);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Provider failed, trying fallback', { provider: candidate, error: lastError.message });
      }
    }

    if (callbacks.onError) {
      callbacks.onError(lastError || new Error('All LLM providers failed'));
    }
    throw lastError || new Error('All LLM providers failed');
  }

  /**
   * Process developer message for /code using provider-specific dev prompts.
   */
  async processDeveloperMessage(chatId: string, message: string): Promise<LLMMessageResult> {
    const provider = this.getProvider(chatId);
    const sequence = this.getDeveloperFallbackSequence(provider);
    let lastError: Error | undefined;

    for (const candidate of sequence) {
      try {
        if (candidate === 'zai' && this.services.zai) {
          const response = await this.services.zai.processDevMessage(chatId, message, {
            model: this.getDeveloperModel(chatId, candidate),
          });
          return { text: response.text, provider: candidate, isFallback: candidate !== provider };
        }
        if (candidate === 'minimax' && this.services.minimax) {
          const response = await this.services.minimax.processDeveloperMessage(chatId, message, {
            model: this.getDeveloperModel(chatId, candidate),
          });
          return { text: response.text, provider: candidate, isFallback: candidate !== provider };
        }
        if (candidate === 'mistral' && this.services.mistral) {
          const response = await this.services.mistral.processDeveloperMessage(chatId, message, {
            model: this.getDeveloperModel(chatId, candidate),
          });
          return { text: response.text, provider: candidate, isFallback: candidate !== provider };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn('Developer provider failed, trying fallback', { provider: candidate, error: lastError.message });
      }
    }

    throw lastError || new Error('No developer-capable provider available');
  }

  private getFallbackSequence(provider: LLMProvider): LLMProvider[] {
    const sequence = [provider, ...this.fallbackOrder];
    const deduped: LLMProvider[] = [];
    for (const item of sequence) {
      if (!deduped.includes(item) && this.isProviderAvailable(item)) {
        deduped.push(item);
      }
    }
    return deduped;
  }

  private getDeveloperFallbackSequence(provider: LLMProvider): LLMProvider[] {
    const sequence = [provider, ...this.fallbackOrder];
    const deduped: LLMProvider[] = [];
    for (const item of sequence) {
      if (item !== 'claude-cli' && !deduped.includes(item) && this.isProviderAvailable(item)) {
        deduped.push(item);
      }
    }
    return deduped;
  }

  private async processWithProvider(
    provider: LLMProvider,
    chatId: string,
    message: string,
    callbacks: ClaudeCodeStreamCallbacks
  ): Promise<StreamingResult> {
    if (provider === 'claude-cli' && this.services.claude) {
      return this.services.claude.processMessageStream(chatId, message, callbacks);
    }

    callbacks.onStatusChange?.(StreamStatus.THINKING);
    const startTime = Date.now();
    let text = '';

    if (provider === 'zai' && this.services.zai) {
      const response = await this.services.zai.processMessage(chatId, message, {
        model: this.getModel(chatId, provider),
      });
      text = response.text;
    } else if (provider === 'minimax' && this.services.minimax) {
      const response = await this.services.minimax.processMessage(chatId, message, {
        model: this.getModel(chatId, provider),
      });
      text = response.text;
    } else if (provider === 'mistral' && this.services.mistral) {
      const response = await this.services.mistral.processMessage(chatId, message, {
        model: this.getModel(chatId, provider),
      });
      text = response.text;
    } else {
      throw new Error(`Provider ${provider} is not available`);
    }

    callbacks.onStatusChange?.(StreamStatus.RESPONSE);
    callbacks.onContent?.(text);

    const result: StreamingResult = {
      text,
      sessionId: `${provider}:${chatId}`,
      isNewSession: false,
      durationMs: Date.now() - startTime,
      exitCode: 0,
      toolHistory: [],
    };

    callbacks.onComplete?.(result);
    return result;
  }
}
