/**
 * LLM Router Types
 */

export type LLMProvider = 'zai' | 'minimax' | 'mistral' | 'claude-cli';

export interface LLMProviderStatus {
  provider: LLMProvider;
  label: string;
  available: boolean;
  reason?: string;
}

export interface LLMMessageResult {
  text: string;
  provider: LLMProvider;
  isFallback: boolean;
}
