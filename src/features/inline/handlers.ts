/**
 * Inline Query Handlers
 * Handle different types of inline queries
 */

import type { InlineQueryResult } from '../../api/types';
import type { InlineContext, InlineHandler } from './types';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'Inline' });

// =============================================================================
// Weather Handler
// =============================================================================

async function handleWeather(context: InlineContext): Promise<InlineQueryResult[]> {
  const city = context.query.replace(/^(weather|weer|w)\s+/i, '').trim();

  if (!city) {
    return [{
      id: 'weather-error',
      type: 'article',
      title: '❌ Geen stad opgegeven',
      input_message_content: {
        message_text: 'Gebruik: @ChefClaudeBot weather <stad>\nVoorbeeld: @ChefClaudeBot weather Amsterdam',
        parse_mode: 'Markdown',
      },
    }];
  }

  // Fetch weather (using a free API or mock for now)
  const result = await fetchWeather(city);

  return [{
    id: 'weather-result',
    type: 'article',
    title: `🌤️ Weer in ${city}`,
    description: result,
    input_message_content: {
      message_text: `🌤️ *Weer in ${city}*\n\n${result}`,
      parse_mode: 'Markdown',
    },
  }];
}

async function fetchWeather(city: string): Promise<string> {
  try {
    // Using wttr.in - free weather service, no API key needed
    const axios = (await import('axios')).default;
    const response = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, {
      timeout: 5000,
    });

    const current = response.data.current_condition?.[0];
    if (current) {
      const temp = current.temp_C;
      const desc = current.weatherDesc?.[0]?.value || 'Onbekend';
      const humidity = current.humidity;
      const wind = current.windspeedKmph;

      return `*Temperatuur:* ${temp}°C\n*Omschrijving:* ${desc}\n*Vochtigheid:* ${humidity}%\n*Wind:* ${wind} km/h`;
    }

    return '❌ Kon weer informatie niet ophalen';
  } catch (error) {
    logger.warn('Weather fetch error', { error });
    return `❌ Fout bij ophalen weer voor ${city}`;
  }
}

// =============================================================================
// Translation Handler
// =============================================================================

async function handleTranslate(context: InlineContext): Promise<InlineQueryResult[]> {
  const match = context.query.match(/^(tr|translate|vertaal)\s+(\w+)?\s+(.+)/i);
  if (!match) {
    return [{
      id: 'translate-error',
      type: 'article',
      title: '❌ Ongeldig formaat',
      input_message_content: {
        message_text: 'Gebruik: @ChefClaudeBot tr <taal> <tekst>\nVoorbeeld: @ChefClaudeBot tr nl Hello world\n\nTalen: nl, en, de, fr, es, it',
        parse_mode: 'Markdown',
      },
    }];
  }

  const [, , targetLang, text] = match;

  if (!text || !targetLang) {
    return [{
      id: 'translate-error',
      type: 'article',
      title: '❌ Ongeldig formaat',
      input_message_content: {
        message_text: 'Gebruik: @ChefClaudeBot tr <taal> <tekst>',
        parse_mode: 'Markdown',
      },
    }];
  }

  const result = await translateText(text, targetLang);

  return [{
    id: 'translate-result',
    type: 'article',
    title: `🌐 Vertaling (${targetLang.toUpperCase()})`,
    description: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
    input_message_content: {
      message_text: `🌐 *Vertaling*\n\n*Van:* ${text}\n*Naar (${targetLang}):* ${result}`,
      parse_mode: 'Markdown',
    },
  }];
}

async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    // Using LibreTranslate (free, open source)
    const axios = (await import('axios')).default;
    const response = await axios.post('https://libretranslate.com/translate', {
      q: text,
      source: 'auto',
      target: targetLang,
      format: 'text',
    }, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return response.data.translatedText || text;
  } catch (error) {
    logger.warn('Translation error', { error });
    return `⚠️ Vertaling mislukt: ${text}`;
  }
}

// =============================================================================
// Calculator Handler
// =============================================================================

function handleCalculator(context: InlineContext): InlineQueryResult[] {
  const expression = context.query.replace(/^(calc|c|=\s*)/i, '').trim();

  if (!expression) {
    return [{
      id: 'calc-error',
      type: 'article',
      title: '❌ Geen expressie',
      input_message_content: {
        message_text: 'Gebruik: @ChefClaudeBot calc <expressie>\nVoorbeeld: @ChefClaudeBot calc 2 + 2 * 5',
        parse_mode: 'Markdown',
      },
    }];
  }

  try {
    // Safe evaluation of mathematical expressions
    const sanitized = expression.replace(/[^0-9+\-*/().%\s^]/g, '');
    const result = Function('"use strict"; return (' + sanitized + ')')();

    return [{
      id: 'calc-result',
      type: 'article',
      title: `🧮 ${expression} = ${result}`,
      description: `Resultaat: ${result}`,
      input_message_content: {
        message_text: `🧮 *Berekening*\n\n${expression} = *${result}*`,
        parse_mode: 'Markdown',
      },
    }];
  } catch (error) {
    return [{
      id: 'calc-error',
      type: 'article',
      title: '❌ Ongeldige expressie',
      input_message_content: {
        message_text: `❌ Ongeldige expressie: ${expression}`,
        parse_mode: 'Markdown',
      },
    }];
  }
}

// =============================================================================
// Note Handler
// =============================================================================

function handleNote(context: InlineContext): InlineQueryResult[] {
  const noteContent = context.query.replace(/^(note|n|notitie)\s+/i, '').trim();

  if (!noteContent) {
    return [{
      id: 'note-error',
      type: 'article',
      title: '❌ Geen notitie',
      input_message_content: {
        message_text: 'Gebruik: @ChefClaudeBot note <jouw notitie>\nVoorbeeld: @ChefClaudeBot note Boodschappen: melk, brood',
        parse_mode: 'Markdown',
      },
    }];
  }

  return [{
    id: 'note-result',
    type: 'article',
    title: `📝 Notitie opslaan`,
    description: noteContent.substring(0, 50) + (noteContent.length > 50 ? '...' : ''),
    input_message_content: {
      message_text: `📝 *Notitie opgeslagen*\n\n${noteContent}`,
      parse_mode: 'Markdown',
    },
  }];
}

// =============================================================================
// Definition Handler
// =============================================================================

async function handleDefine(context: InlineContext): Promise<InlineQueryResult[]> {
  const word = context.query.replace(/^(def|define|betekenis)\s+/i, '').trim();

  if (!word) {
    return [{
      id: 'define-error',
      type: 'article',
      title: '❌ Geen woord opgegeven',
      input_message_content: {
        message_text: 'Gebruik: @ChefClaudeBot define <woord>\nVoorbeeld: @ChefClaudeBot define computer',
        parse_mode: 'Markdown',
      },
    }];
  }

  const definition = await getDefinition(word);

  return [{
    id: 'define-result',
    type: 'article',
    title: `📚 Definitie: ${word}`,
    description: definition.substring(0, 50) + (definition.length > 50 ? '...' : ''),
    input_message_content: {
      message_text: `📚 *${word}*\n\n${definition}`,
      parse_mode: 'Markdown',
    },
  }];
}

async function getDefinition(word: string): Promise<string> {
  try {
    // Using Free Dictionary API
    const axios = (await import('axios')).default;
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
      timeout: 5000,
    });

    const entry = response.data[0];
    const meaning = entry?.meanings?.[0];
    const definition = meaning?.definitions?.[0]?.definition;

    if (definition) {
      return `*Definitie:* ${definition}\n*Deel van speech:* ${meaning.partOfSpeech || 'Onbekend'}`;
    }

    return `❌ Geen definitie gevonden voor "${word}"`;
  } catch (error) {
    logger.warn('Definition fetch error', { error });
    return `❌ Kon definitie niet ophalen voor "${word}"`;
  }
}

// =============================================================================
// Handler Registry
// =============================================================================

export const INLINE_HANDLERS: InlineHandler[] = [
  {
    pattern: /^(weather|weer|w)\s+/i,
    handler: handleWeather,
    description: '🌤️ Weather: @ChefClaudeBot weather <stad>',
  },
  {
    pattern: /^(tr|translate|vertaal)\s+/i,
    handler: handleTranslate,
    description: '🌐 Translate: @ChefClaudeBot tr <taal> <tekst>',
  },
  {
    pattern: /^(calc|c|=)\s*/i,
    handler: handleCalculator,
    description: '🧮 Calculator: @ChefClaudeBot calc <expressie>',
  },
  {
    pattern: /^(note|n|notitie)\s+/i,
    handler: handleNote,
    description: '📝 Note: @ChefClaudeBot note <tekst>',
  },
  {
    pattern: /^(def|define|betekenis)\s+/i,
    handler: handleDefine,
    description: '📚 Define: @ChefClaudeBot define <woord>',
  },
];

// =============================================================================
// Router
// =============================================================================

export async function routeInlineQuery(context: InlineContext): Promise<InlineQueryResult[]> {
  logger.debug('Routing inline query', { query: context.query });

  for (const handler of INLINE_HANDLERS) {
    if (handler.pattern.test(context.query)) {
      logger.info(`Matched handler: ${handler.description}`);
      const results = await handler.handler(context);
      return results;
    }
  }

  // No match found, show help
  return [{
    id: 'inline-help',
    type: 'article',
    title: '❓ Inline Mode Help',
    input_message_content: {
      message_text: `*Inline Mode Commands*\n\n${INLINE_HANDLERS.map(h => h.description).join('\n')}\n\n_Gebruik @ChefClaudeBot in elk chat!_`,
      parse_mode: 'Markdown',
    },
  }];
}
