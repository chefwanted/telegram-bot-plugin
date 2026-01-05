/**
 * Developer Commands
 * Telegram commands voor code-ontwikkeling
 */

import type { Message } from '../../types/telegram';
import type { ApiMethods } from '../../api';
import type { ZAIService } from '../../zai';
import {
  getDevSession,
  clearDevSession,
  setProjectContext,
  getProjectContext,
  listFiles,
  readFile,
  writeFile,
  fileExists,
  addFocusedFile,
  removeFocusedFile,
  clearFocusedFiles,
  getFocusedFilesContent,
  getPendingPatches,
  applyPatch,
  rejectPatch,
  applyAllPatches,
  getContextSummary,
  buildLLMContext,
} from './context';
import { executeCodeTask } from './executor';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'DevCmd' });

// =============================================================================
// Project Command - /project
// =============================================================================

export async function projectCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const action = args[0]?.toLowerCase();

  if (!action) {
    // Show current project or help
    const ctx = getProjectContext(String(chatId));
    if (ctx) {
      await api.sendMessage({
        chat_id: chatId,
        text: `📂 Huidig project:\n\n${getContextSummary(String(chatId))}`,
      });
    } else {
      await api.sendMessage({
        chat_id: chatId,
        text: `📂 Project Management

/project open <pad> - Open een project
/project info - Toon project info
/project close - Sluit project
/project files [pad] - Toon bestanden
/project tree - Toon directory tree`,
      });
    }
    return;
  }

  switch (action) {
    case 'open':
    case 'set': {
      const projectPath = args.slice(1).join(' ').trim();
      if (!projectPath) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Geef een pad op: /project open /pad/naar/project',
        });
        return;
      }

      try {
        const ctx = setProjectContext(String(chatId), projectPath);
        await api.sendMessage({
          chat_id: chatId,
          text: `✅ Project geopend: ${ctx.name}\n📍 ${ctx.rootPath}\n\nGebruik /files om bestanden te bekijken.`,
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ Kon project niet openen: ${errorMessage}`,
        });
      }
      break;
    }

    case 'info': {
      const summary = getContextSummary(String(chatId));
      await api.sendMessage({ chat_id: chatId, text: summary });
      break;
    }

    case 'close': {
      clearDevSession(String(chatId));
      await api.sendMessage({
        chat_id: chatId,
        text: '✅ Project gesloten en sessie gewist.',
      });
      break;
    }

    case 'files':
    case 'ls': {
      const subPath = args.slice(1).join(' ').trim();
      await filesCommand(api, message, subPath ? [subPath] : []);
      break;
    }

    case 'tree': {
      await treeCommand(api, message, args.slice(1));
      break;
    }

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Onbekende actie: ${action}\nGebruik /project voor help.`,
      });
  }
}

// =============================================================================
// Files Command - /files
// =============================================================================

export async function filesCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const ctx = getProjectContext(String(chatId));

  if (!ctx) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geen project geopend. Gebruik /project open <pad> eerst.',
    });
    return;
  }

  const subPath = args.join(' ').trim();
  const files = listFiles(ctx.rootPath, subPath, {
    recursive: false,
    excludePatterns: ['node_modules', '.git', 'dist', 'build'],
  });

  if (files.length === 0) {
    await api.sendMessage({
      chat_id: chatId,
      text: `📁 ${subPath || '/'}\n\nGeen bestanden gevonden.`,
    });
    return;
  }

  // Group by type
  const dirs = files.filter(f => f.isDirectory).sort((a, b) => a.name.localeCompare(b.name));
  const regularFiles = files.filter(f => !f.isDirectory).sort((a, b) => a.name.localeCompare(b.name));

  const lines: string[] = [`📁 ${ctx.name}/${subPath || ''}`, ''];

  if (dirs.length > 0) {
    lines.push('📂 Directories:');
    for (const dir of dirs.slice(0, 20)) {
      lines.push(`  📁 ${dir.name}/`);
    }
    if (dirs.length > 20) {
      lines.push(`  ... en ${dirs.length - 20} meer`);
    }
    lines.push('');
  }

  if (regularFiles.length > 0) {
    lines.push('📄 Bestanden:');
    for (const file of regularFiles.slice(0, 30)) {
      const size = file.size ? ` (${formatSize(file.size)})` : '';
      lines.push(`  📄 ${file.name}${size}`);
    }
    if (regularFiles.length > 30) {
      lines.push(`  ... en ${regularFiles.length - 30} meer`);
    }
  }

  await api.sendMessage({ chat_id: chatId, text: lines.join('\n') });
}

// =============================================================================
// Tree Command - /tree
// =============================================================================

export async function treeCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const ctx = getProjectContext(String(chatId));

  if (!ctx) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geen project geopend. Gebruik /project open <pad> eerst.',
    });
    return;
  }

  const depth = parseInt(args[0] || '2', 10);
  const files = listFiles(ctx.rootPath, '', {
    recursive: true,
    maxDepth: Math.min(depth, 4),
    excludePatterns: ['node_modules', '.git', 'dist', 'build', '__pycache__'],
  });

  const tree = buildTree(files);
  const output = [`🌳 ${ctx.name}`, '', tree].join('\n');

  // Truncate if too long
  const maxLen = 4000;
  const finalOutput = output.length > maxLen 
    ? output.slice(0, maxLen) + '\n... (afgekapt)'
    : output;

  await api.sendMessage({ chat_id: chatId, text: finalOutput });
}

// =============================================================================
// Read Command - /read
// =============================================================================

export async function readCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const ctx = getProjectContext(String(chatId));

  if (!ctx) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geen project geopend. Gebruik /project open <pad> eerst.',
    });
    return;
  }

  const filePath = args.join(' ').trim();
  if (!filePath) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geef een bestandspad op: /read src/index.ts',
    });
    return;
  }

  const content = readFile(ctx.rootPath, filePath);
  if (content === null) {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Bestand niet gevonden: ${filePath}`,
    });
    return;
  }

  // Determine language for syntax highlighting
  const ext = filePath.split('.').pop() || 'txt';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    json: 'json',
    md: 'markdown',
    yml: 'yaml',
    yaml: 'yaml',
    sh: 'bash',
    css: 'css',
    html: 'html',
  };
  const lang = langMap[ext] || ext;

  // Truncate if needed
  const maxLen = 3800;
  let output = content;
  let truncated = false;
  if (output.length > maxLen) {
    output = output.slice(0, maxLen);
    truncated = true;
  }

  const header = `📄 ${filePath}`;
  const codeBlock = '```' + lang + '\n' + output + (truncated ? '\n... (afgekapt)' : '') + '\n```';

  await api.sendMessage({
    chat_id: chatId,
    text: `${header}\n\n${codeBlock}`,
    parse_mode: 'Markdown',
  });
}

// =============================================================================
// Focus Command - /focus
// =============================================================================

export async function focusCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const ctx = getProjectContext(String(chatId));

  if (!ctx) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geen project geopend. Gebruik /project open <pad> eerst.',
    });
    return;
  }

  const action = args[0]?.toLowerCase();

  if (!action || action === 'list') {
    if (ctx.focusedFiles.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: '📎 Geen gefocuste bestanden.\n\nGebruik /focus add <bestand> om toe te voegen.',
      });
    } else {
      const lines = ['📎 Gefocuste bestanden:', ''];
      for (let i = 0; i < ctx.focusedFiles.length; i++) {
        lines.push(`${i + 1}. ${ctx.focusedFiles[i]}`);
      }
      lines.push('', '/focus add <bestand> - Toevoegen');
      lines.push('/focus remove <nummer> - Verwijderen');
      lines.push('/focus clear - Alles wissen');
      await api.sendMessage({ chat_id: chatId, text: lines.join('\n') });
    }
    return;
  }

  switch (action) {
    case 'add': {
      const filePath = args.slice(1).join(' ').trim();
      if (!filePath) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Geef een bestandspad op: /focus add src/index.ts',
        });
        return;
      }

      if (!fileExists(ctx.rootPath, filePath)) {
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ Bestand niet gevonden: ${filePath}`,
        });
        return;
      }

      addFocusedFile(String(chatId), filePath);
      await api.sendMessage({
        chat_id: chatId,
        text: `✅ ${filePath} toegevoegd aan focus.\n\nNu ${ctx.focusedFiles.length} bestand(en) in focus.`,
      });
      break;
    }

    case 'remove':
    case 'rm': {
      const indexStr = args[1];
      if (!indexStr) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Geef een nummer op: /focus remove 1',
        });
        return;
      }

      const index = parseInt(indexStr, 10) - 1;
      if (index < 0 || index >= ctx.focusedFiles.length) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Ongeldig nummer.',
        });
        return;
      }

      const removed = ctx.focusedFiles[index];
      removeFocusedFile(String(chatId), removed);
      await api.sendMessage({
        chat_id: chatId,
        text: `✅ ${removed} verwijderd uit focus.`,
      });
      break;
    }

    case 'clear': {
      clearFocusedFiles(String(chatId));
      await api.sendMessage({
        chat_id: chatId,
        text: '✅ Alle gefocuste bestanden gewist.',
      });
      break;
    }

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: '❌ Onbekende actie. Gebruik: add, remove, clear, of list',
      });
  }
}

// =============================================================================
// Patch Command - /patch
// =============================================================================

export async function patchCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const ctx = getProjectContext(String(chatId));

  if (!ctx) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geen project geopend. Gebruik /project open <pad> eerst.',
    });
    return;
  }

  const action = args[0]?.toLowerCase();
  const patches = getPendingPatches(String(chatId));

  if (!action || action === 'list') {
    if (patches.length === 0) {
      await api.sendMessage({
        chat_id: chatId,
        text: '📝 Geen pending patches.\n\nGebruik /code om wijzigingen te genereren.',
      });
    } else {
      const lines = ['📝 Pending Patches:', ''];
      for (const patch of patches) {
        lines.push(`• ${patch.id}`);
        lines.push(`  📄 ${patch.filePath}`);
        lines.push(`  📝 ${patch.description}`);
        lines.push('');
      }
      lines.push('/patch apply <id> - Pas patch toe');
      lines.push('/patch reject <id> - Weiger patch');
      lines.push('/patch apply_all - Pas alle patches toe');
      lines.push('/patch show <id> - Toon diff');
      await api.sendMessage({ chat_id: chatId, text: lines.join('\n') });
    }
    return;
  }

  switch (action) {
    case 'apply': {
      const patchId = args[1];
      if (!patchId) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Geef een patch ID op: /patch apply patch_1_...',
        });
        return;
      }

      const success = applyPatch(String(chatId), patchId);
      if (success) {
        await api.sendMessage({
          chat_id: chatId,
          text: `✅ Patch ${patchId} toegepast!`,
        });
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ Kon patch niet toepassen: ${patchId}`,
        });
      }
      break;
    }

    case 'reject': {
      const patchId = args[1];
      if (!patchId) {
        await api.sendMessage({
          chat_id: chatId,
          text: '❌ Geef een patch ID op: /patch reject patch_1_...',
        });
        return;
      }

      const success = rejectPatch(String(chatId), patchId);
      if (success) {
        await api.sendMessage({
          chat_id: chatId,
          text: `✅ Patch ${patchId} geweigerd.`,
        });
      } else {
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ Kon patch niet weigeren: ${patchId}`,
        });
      }
      break;
    }

    case 'apply_all':
    case 'applyall': {
      const result = applyAllPatches(String(chatId));
      await api.sendMessage({
        chat_id: chatId,
        text: `✅ Patches toegepast: ${result.applied}\n❌ Gefaald: ${result.failed}`,
      });
      break;
    }

    case 'show': {
      const patchId = args[1];
      const patch = patches.find(p => p.id === patchId);
      if (!patch) {
        await api.sendMessage({
          chat_id: chatId,
          text: `❌ Patch niet gevonden: ${patchId}`,
        });
        return;
      }

      const output = [
        `📝 Patch: ${patch.id}`,
        `📄 Bestand: ${patch.filePath}`,
        `📝 ${patch.description}`,
        '',
        '```diff',
        patch.diff.slice(0, 3000),
        '```',
      ].join('\n');

      await api.sendMessage({
        chat_id: chatId,
        text: output,
        parse_mode: 'Markdown',
      });
      break;
    }

    default:
      await api.sendMessage({
        chat_id: chatId,
        text: '❌ Onbekende actie. Gebruik: list, apply, reject, apply_all, show',
      });
  }
}

// =============================================================================
// Write Command - /write
// =============================================================================

export async function writeCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const ctx = getProjectContext(String(chatId));

  if (!ctx) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geen project geopend. Gebruik /project open <pad> eerst.',
    });
    return;
  }

  // Format: /write <path> <content>
  const filePath = args[0];
  const content = args.slice(1).join(' ');

  if (!filePath) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Gebruik: /write <pad> <inhoud>\nOf reply op een bericht met code.',
    });
    return;
  }

  if (!content && message.reply_to_message?.text) {
    // Use reply message content
    const replyContent = message.reply_to_message.text;
    const success = writeFile(ctx.rootPath, filePath, replyContent);
    if (success) {
      await api.sendMessage({
        chat_id: chatId,
        text: `✅ Bestand geschreven: ${filePath}`,
      });
    } else {
      await api.sendMessage({
        chat_id: chatId,
        text: `❌ Kon bestand niet schrijven: ${filePath}`,
      });
    }
    return;
  }

  if (!content) {
    await api.sendMessage({
      chat_id: chatId,
      text: '❌ Geef inhoud op of reply op een bericht met code.',
    });
    return;
  }

  const success = writeFile(ctx.rootPath, filePath, content);
  if (success) {
    await api.sendMessage({
      chat_id: chatId,
      text: `✅ Bestand geschreven: ${filePath}`,
    });
  } else {
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Kon bestand niet schrijven: ${filePath}`,
    });
  }
}

// =============================================================================
// Code Command - /code (enhanced)
// =============================================================================

export async function codeCommand(
  api: ApiMethods,
  message: Message,
  args: string[],
  zaiService?: ZAIService
): Promise<void> {
  const chatId = message.chat.id;
  const instruction = args.join(' ').trim();

  if (!zaiService) {
    await api.sendMessage({
      chat_id: chatId,
      text: '⚠️ AI service niet beschikbaar. Configureer ZAI_API_KEY.',
    });
    return;
  }

  if (!instruction) {
    await api.sendMessage({
      chat_id: chatId,
      text: `💻 Code Assistant

/code <opdracht> - Vraag om code-wijzigingen

Voorbeelden:
• /code voeg logging toe aan de API client
• /code fix de TypeScript errors in bot.ts
• /code maak een nieuwe /status command

Tips:
• Gebruik /project open <pad> om context te geven
• Gebruik /focus add <bestand> om bestanden toe te voegen
• Wijzigingen worden als patches voorgesteld`,
    });
    return;
  }

  // Get project context if available
  const ctx = getProjectContext(String(chatId));
  let contextInfo = '';

  if (ctx) {
    contextInfo = buildLLMContext(String(chatId));
  }

  try {
    await api.sendMessage({
      chat_id: chatId,
      text: '🤔 Bezig met analyseren...',
    });

    const result = await executeCodeTask(
      String(chatId),
      instruction,
      contextInfo,
      zaiService
    );

    // Send result (may be long, split if needed)
    const chunks = splitMessage(result, 4000);
    for (const chunk of chunks) {
      await api.sendMessage({
        chat_id: chatId,
        text: chunk,
        parse_mode: 'Markdown',
      });
    }
  } catch (error: any) {
    logger.error('Code command error', { error, chatId });
    await api.sendMessage({
      chat_id: chatId,
      text: `❌ Fout: ${error?.message || 'onbekende fout'}`,
    });
  }
}

// =============================================================================
// Dev Help Command - /dev
// =============================================================================

export async function devHelpCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;

  const helpText = `
🛠️ Developer Mode - Help

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 PROJECT MANAGEMENT
/project open <pad> - Open project
/project info - Toon project info
/project close - Sluit project
/project files [pad] - Toon bestanden
/project tree - Directory structuur

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 BESTANDEN
/files [pad] - Lijst bestanden
/tree [diepte] - Directory tree
/read <bestand> - Lees bestand
/write <bestand> <inhoud> - Schrijf bestand

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📎 FOCUS (context voor AI)
/focus - Toon gefocuste bestanden
/focus add <bestand> - Voeg toe
/focus remove <n> - Verwijder
/focus clear - Wis alles

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💻 CODE ASSISTANT
/code <opdracht> - Vraag om wijzigingen
Gebruikt gefocuste bestanden als context!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📝 PATCHES
/patch - Toon pending patches
/patch apply <id> - Pas toe
/patch reject <id> - Weiger
/patch apply_all - Pas alle toe
/patch show <id> - Toon diff

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔧 WORKFLOW VOORBEELD

1. /project open /home/user/myproject
2. /files src
3. /focus add src/index.ts
4. /read src/index.ts
5. /code voeg error handling toe
6. /patch show patch_1_...
7. /patch apply patch_1_...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 TIPS
• Focus bestanden worden meegestuurd naar AI
• Patches worden niet automatisch toegepast
• Gebruik /git voor versiebeheer
`.trim();

  await api.sendMessage({ chat_id: chatId, text: helpText });
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function buildTree(files: { path: string; isDirectory: boolean }[]): string {
  const lines: string[] = [];
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted.slice(0, 100)) {
    const depth = file.path.split('/').length - 1;
    const indent = '  '.repeat(depth);
    const icon = file.isDirectory ? '📁' : '📄';
    const name = file.path.split('/').pop() || file.path;
    lines.push(`${indent}${icon} ${name}${file.isDirectory ? '/' : ''}`);
  }

  if (sorted.length > 100) {
    lines.push(`... en ${sorted.length - 100} meer`);
  }

  return lines.join('\n');
}

function splitMessage(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point
    let splitAt = maxLen;
    const newlineIdx = remaining.lastIndexOf('\n', maxLen);
    if (newlineIdx > maxLen * 0.5) {
      splitAt = newlineIdx + 1;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  return chunks;
}
