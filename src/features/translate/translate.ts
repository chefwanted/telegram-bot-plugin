/**
 * Translation Feature - Simple translation service
 */

import axios from 'axios';

// LibreTranslate API (free, open source)
// Alternatively use Google Translate API
const LIBRE_TRANSLATE_API = 'https://libretranslate.com/translate';

export interface TranslateOptions {
  text: string;
  source?: string; // 'auto' for auto-detect
  target: string;
}

export interface TranslationResult {
  translatedText: string;
  sourceLanguage: string;
  confidence?: number;
}

export async function translateText(options: TranslateOptions): Promise<TranslationResult> {
  try {
    const response = await axios.post(LIBRE_TRANSLATE_API, {
      q: options.text,
      source: options.source || 'auto',
      target: options.target,
      format: 'text',
    });

    return {
      translatedText: response.data.translatedText,
      sourceLanguage: response.data.detectedLanguage?.language || options.source || 'unknown',
    };
  } catch (error) {
    // Fallback to simple mock if API fails
    return mockTranslate(options);
  }
}

// Fallback mock translation
function mockTranslate(options: TranslateOptions): TranslationResult {
  const prefixes: Record<string, string> = {
    en: '🇬🇧 [EN] ',
    nl: '🇳🇱 [NL] ',
    de: '🇩🇪 [DE] ',
    fr: '🇫🇷 [FR] ',
    es: '🇪🇸 [ES] ',
    it: '🇮🇹 [IT] ',
  };

  const prefix = prefixes[options.target] || `[${options.target.toUpperCase()}] `;
  return {
    translatedText: prefix + options.text,
    sourceLanguage: options.source || 'unknown',
  };
}

// Language code mappings
export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  nl: 'Nederlands',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  ru: 'Русский',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  ar: 'العربية',
};
