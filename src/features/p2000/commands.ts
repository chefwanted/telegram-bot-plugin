/**
 * P2000 Commands
 * Command handlers for P2000 feature
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import { getP2000Scraper, type P2000Scraper } from './scraper';
import { getSubscriptionManager, type P2000SubscriptionManager } from './subscription';
import { COMMON_UTRECHT_CITIES, getMunicipalities } from './filters';

// Use singleton for production, but allow injection for testing
let scraperInstance: P2000Scraper | null = null;
let subscriptionManagerInstance: P2000SubscriptionManager | null = null;

/**
 * Get the scraper instance (allows dependency injection for testing)
 */
export function getScraper(): P2000Scraper {
  if (!scraperInstance) {
    scraperInstance = getP2000Scraper();
  }
  return scraperInstance;
}

/**
 * Get the subscription manager instance
 */
export function getSubManager(): P2000SubscriptionManager {
  if (!subscriptionManagerInstance) {
    subscriptionManagerInstance = getSubscriptionManager();
  }
  return subscriptionManagerInstance;
}

/**
 * Set a custom scraper instance (for testing)
 */
export function setScraper(scraper: P2000Scraper): void {
  scraperInstance = scraper;
}

/**
 * Set a custom subscription manager instance (for testing)
 */
export function setSubManager(manager: P2000SubscriptionManager): void {
  subscriptionManagerInstance = manager;
}

// =============================================================================
// P2000 Commands
// =============================================================================

export async function p2000Command(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const chatId = message.chat.id;
  const scraper = getScraper();

  // Parse arguments
  const filter = args[0]?.toLowerCase();
  const limitArg = args[1] ? parseInt(args[1], 10) : 10;
  const limit = Math.min(Math.max(limitArg, 1), 20); // Clamp between 1-20

  try {
    let messages;
    let filterLabel = 'alle diensten';

    if (filter === 'brandweer' || filter === 'brand' || filter === 'fire') {
      messages = await scraper.getMessagesByService('brandweer', limit);
      filterLabel = '🚒 Brandweer';
    } else if (filter === 'ambulance' || filter === 'ambu' || filter === 'ems') {
      messages = await scraper.getMessagesByService('ambulance', limit);
      filterLabel = '🚑 Ambulance';
    } else if (filter === 'politie' || filter === 'police') {
      messages = await scraper.getMessagesByService('politie', limit);
      filterLabel = '👮 Politie';
    } else if (filter === 'knm' || filter === 'kust') {
      messages = await scraper.getMessagesByService('knm', limit);
      filterLabel = '⚓ Kustwacht';
    } else if (filter) {
      // Check if it's a region filter
      messages = await scraper.fetchMessages({ regions: [filter], limit });
      filterLabel = `📍 ${filter}`;
    } else {
      messages = await scraper.fetchMessages({ limit });
    }

    if (messages.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Geen recente meldingen gevonden voor ${filterLabel} in Utrecht regio.\n\nProbeer later opnieuw of gebruik /p2000 help voor opties.`,
      });
      return;
    }

    // Format messages
    const displayCount = Math.min(messages.length, 5);
    const header = `*🚨 P2000 Meldingen Utrecht*\n_Filter: ${filterLabel} | ${displayCount} van ${messages.length} weergegeven_\n\n`;
    const messagesText = messages
      .slice(0, 5) // Limit to 5 for readability
      .map(m => scraper.formatMessage(m))
      .join('\n---\n\n');

    await api.sendMessage({
      chat_id: chatId,
      text: header + messagesText,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('P2000 command error:', error);
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Er is een fout opgetreden bij het ophalen van P2000 meldingen.\n\nProbeer het later opnieuw.',
    });
  }
}

export async function p2000SubscribeCommand(api: ApiMethods, message: Message, args: string[]): Promise<void> {
  const chatId = String(message.chat.id);
  const subManager = getSubManager();
  const action = args[0]?.toLowerCase();

  try {
    if (action === 'on' || action === 'aan' || action === 'start') {
      // Enable subscription
      await subManager.enable(chatId);
      
      const sub = await subManager.getSubscription(chatId);
      const regionText = sub?.regions && sub.regions.length > 0
        ? sub.regions.join(', ')
        : 'Hele Utrecht provincie';

      await api.sendMessage({
        chat_id: chatId,
        text: `✅ *Push notificaties ingeschakeld*\n\n📍 Regio: ${regionText}\n🔔 Je ontvangt nu live meldingen\n\nGebruik:\n• /p2000 subscribe off - Uitschakelen\n• /p2000 subscribe filter - Filters instellen\n• /p2000 subscribe status - Status bekijken`,
        parse_mode: 'Markdown',
      });
    } else if (action === 'off' || action === 'uit' || action === 'stop') {
      // Disable subscription
      const disabled = await subManager.disable(chatId);
      
      if (disabled) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Push notificaties zijn uitgeschakeld.\n\nGebruik /p2000 subscribe on om weer in te schakelen.',
        });
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: '⚠️ Je hebt momenteel geen actief abonnement.\n\nGebruik /p2000 subscribe on om te beginnen.',
        });
      }
    } else if (action === 'status') {
      // Show subscription status
      const sub = await subManager.getSubscription(chatId);
      
      if (!sub) {
        await api.sendMessage({
          chat_id: chatId,
          text: '📊 *Abonnement Status*\n\n❌ Geen actief abonnement\n\nGebruik /p2000 subscribe on om te starten.',
          parse_mode: 'Markdown',
        });
        return;
      }

      const statusEmoji = sub.enabled ? '✅' : '⏸️';
      const regionText = sub.regions.length > 0 ? sub.regions.join(', ') : 'Utrecht provincie';
      const filterCount = sub.filters.length;
      const filterText = filterCount > 0 ? `${filterCount} actieve filter(s)` : 'Geen filters';

      await api.sendMessage({
        chat_id: chatId,
        text: `📊 *Abonnement Status*\n\n${statusEmoji} Status: ${sub.enabled ? 'Actief' : 'Gepauzeerd'}\n📍 Regio: ${regionText}\n🔍 Filters: ${filterText}\n\nGebruik:\n• /p2000 subscribe ${sub.enabled ? 'off' : 'on'} - ${sub.enabled ? 'Pauzeren' : 'Hervatten'}\n• /p2000 subscribe filter - Filters aanpassen`,
        parse_mode: 'Markdown',
      });
    } else if (action === 'filter' || action === 'filters') {
      // Show filter options
      await api.sendMessage({
        chat_id: chatId,
        text: `🔍 *Filter Opties* (Binnenkort beschikbaar)\n\nJe kunt binnenkort filteren op:\n• Dienst type (brandweer, ambulance, politie)\n• Prioriteit niveau\n• Specifieke zoekwoorden\n• Specifieke steden\n\nGebruik voorlopig /p2000 [dienst] voor gefilterde meldingen.`,
        parse_mode: 'Markdown',
      });
    } else {
      // Show help
      const isSubscribed = await subManager.isSubscribed(chatId);
      
      await api.sendMessage({
        chat_id: chatId,
        text: `*🚨 P2000 Abonnement*\n\n${isSubscribed ? '✅ Je bent momenteel geabonneerd' : '⚪ Je bent niet geabonneerd'}\n\n*Commando's:*\n• /p2000 subscribe on - Inschakelen\n• /p2000 subscribe off - Uitschakelen\n• /p2000 subscribe status - Status bekijken\n• /p2000 subscribe filter - Filters instellen\n\n*Je ontvangt meldingen van:*\n🚒 Brandweer\n🚑 Ambulance\n👮 Politie\n⚓ Kustwacht\n\n📍 Standaard regio: Utrecht provincie\n⏱️ Update interval: 30 seconden`,
        parse_mode: 'Markdown',
      });
    }
  } catch (error) {
    console.error('Subscription command error:', error);
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Er is een fout opgetreden. Probeer het later opnieuw.',
    });
  }
}

export async function p2000StatsCommand(api: ApiMethods, message: Message): Promise<void> {
  const chatId = message.chat.id;
  const subManager = getSubManager();

  try {
    const stats = await subManager.getStats();
    
    const serviceStats = Object.entries(stats.byService)
      .map(([service, count]) => `  • ${service}: ${count}`)
      .join('\n') || '  Geen filters ingesteld';

    await api.sendMessage({
      chat_id: chatId,
      text: `📊 *P2000 Statistieken*\n\n*Abonnementen:*\n• Totaal: ${stats.total}\n• Actief: ${stats.enabled}\n• Gepauzeerd: ${stats.disabled}\n\n*Filters per dienst:*\n${serviceStats}`,
      parse_mode: 'Markdown',
    });
  } catch (error) {
    console.error('Stats command error:', error);
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Kon statistieken niet ophalen.',
    });
  }
}

export async function p2000HelpCommand(api: ApiMethods, message: Message): Promise<void> {
  const chatId = message.chat.id;

  const municipalities = getMunicipalities().slice(0, 15).join(', ');
  
  const helpText = `*🚨 P2000 Help*

*Beschikbare commando's:*

/p2000 - Laatste meldingen (alle diensten)
/p2000 brandweer - 🚒 Alleen brandweer
/p2000 ambulance - 🚑 Alleen ambulance  
/p2000 politie - 👮 Alleen politie
/p2000 knm - ⚓ Kustwacht
/p2000 [stad] - Filter op locatie
/p2000 subscribe on/off - Push meldingen

*Voorbeelden:*
• /p2000 brandweer 10 - 10 brandweer meldingen
• /p2000 Utrecht - Meldingen in Utrecht
• /p2000 Amersfoort - Meldingen in Amersfoort

*Gemeenten in Utrecht provincie:*
${municipalities}...

*Populaire steden:*
${COMMON_UTRECHT_CITIES.join(', ')}

_Data wordt elke 5 minuten ververst_
`;

  await api.sendMessage({ 
    chat_id: chatId, 
    text: helpText,
    parse_mode: 'Markdown',
  });
}
