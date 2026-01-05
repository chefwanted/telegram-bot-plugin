/**
 * Search Feature - Search in conversation history
 */

import * as fs from 'fs';
import type { ClaudeService } from '../../claude';

const SEARCH_INDEX_DIR = '/tmp/telegram-bot/search';

export interface SearchResult {
  type: 'conversation' | 'note';
  content: string;
  timestamp: number;
  source: string;
}

export async function searchAll(query: string, chatId: string, claudeService?: ClaudeService): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  // Search in Claude conversations
  if (claudeService) {
    const info = claudeService.getConversationInfo(chatId);
    if (info && info.messageCount > 0) {
      // This would require accessing the conversation store directly
      // For now, add a placeholder
      results.push({
        type: 'conversation',
        content: `Claude gesprek (${info.messageCount} berichten)`,
        timestamp: info.lastActivity.getTime(),
        source: 'claude',
      });
    }
  }

  // Search in notes
  const notesFile = `${SEARCH_INDEX_DIR}/notes_${chatId}.json`;
  if (fs.existsSync(notesFile)) {
    try {
      const notes = JSON.parse(fs.readFileSync(notesFile, 'utf-8'));
      notes.forEach((note: any) => {
        if (note.content?.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'note',
            content: note.content,
            timestamp: note.createdAt || Date.now(),
            source: 'notes',
          });
        }
      });
    } catch {}
  }

  return results.sort((a, b) => b.timestamp - a.timestamp);
}
