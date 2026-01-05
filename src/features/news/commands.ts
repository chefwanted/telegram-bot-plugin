/**
 * News Commands
 * Command handlers for news feature
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { createNewsService } from './news';

const newsService = createNewsService();

// =============================================================================
// News Commands
// =============================================================================

export async function newsCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const chatId = message.chat.id;

  // Check if category is specified
  const category = args[0];

  try {
    const articles = await newsService.fetchNews({
      category,
      limit: 10,
    });

    if (articles.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: category
          ? `❌ Geen nieuws gevonden voor categorie: ${category}\n\nBeschikbare categorieën: ${newsService.getCategories().join(', ')}`
          : '❌ Geen nieuws gevonden. Probeer het later opnieuw.',
      });
      return;
    }

    const formatted = newsService.formatArticles(articles);
    await api.sendMessage({ chat_id: chatId, text: formatted });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Er is een fout opgetreden bij het ophalen van nieuws.',
    });
  }
}

export async function newsSearchCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const chatId = message.chat.id;
  const query = args.join(' ');

  if (!query) {
    await api.sendMessage({
      chat_id: chatId,
      text: '⚠️ Geef een zoekterm op.\n\nGebruik: /news-search <zoekterm>',
    });
    return;
  }

  try {
    const articles = await newsService.searchNews(query, { limit: 10 });

    if (articles.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Geen resultaten gevonden voor: ${query}`,
      });
      return;
    }

    const header = `*🔍 Zoekresultaten voor: ${query}*\n\n`;
    const articlesText = articles.map(article =>
      `*${article.title}*\n_${article.source}_\n${article.description}\n`
    ).join('\n---\n\n');

    await api.sendMessage({
      chat_id: chatId,
      text: header + articlesText.substring(0, 4000),
    });
  } catch (error) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Er is een fout opgetreden bij het zoeken.',
    });
  }
}

export async function newsSourcesCommand(api: ApiMethods, message: Message): Promise<void> {
  const chatId = message.chat.id;

  const categories = newsService.getCategories();
  let text = '*📰 Beschikbare nieuwsbronnen*\n\n';

  for (const category of categories) {
    const sources = newsService.getSources(category);
    const sourceNames = sources.map(s => s.name).join(', ');
    text += `*${category.toUpperCase()}*\n${sourceNames}\n\n`;
  }

  text += '\n💡 Gebruik /news <categorie> om nieuws uit een specifieke categorie te laden.';

  await api.sendMessage({ chat_id: chatId, text });
}
