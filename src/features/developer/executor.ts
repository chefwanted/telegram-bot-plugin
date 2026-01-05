/**
 * Code Task Executor
 * Executes code tasks using AI and manages patches
 */

import type { LLMRouter } from '../../llm';
import { createPatch, getProjectContext, readFile } from './context';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'DevExecutor' });

// Enhanced system prompt for code tasks
const CODE_SYSTEM_PROMPT = `Je bent een expert software engineer die via Telegram helpt met coderen.

REGELS:
1. Antwoord in het Nederlands tenzij anders gevraagd
2. Wees compact en actionable
3. Geef concrete code, geen vage uitleg
4. Bij wijzigingen: geef het VOLLEDIGE nieuwe bestand of een duidelijke patch
5. Gebruik markdown code blocks met de juiste taal
6. Als context ontbreekt, vraag eerst wat je nodig hebt
7. Maximum ~3500 karakters per antwoord

OUTPUT FORMAAT voor wijzigingen:
Gebruik dit formaat als je een bestand wilt aanpassen:

\`\`\`patch:pad/naar/bestand.ts
--- BESCHRIJVING VAN DE WIJZIGING ---
[volledige nieuwe inhoud van het bestand]
\`\`\`

Of voor nieuwe bestanden:
\`\`\`new:pad/naar/nieuw-bestand.ts
[inhoud van het nieuwe bestand]
\`\`\`

BESCHIKBARE CONTEXT:
De gebruiker kan bestanden "focussen" die je dan ziet. Als je geen context hebt, vraag de gebruiker om /focus add <bestand> te gebruiken.`;

/**
 * Execute a code task with AI assistance
 */
export async function executeCodeTask(
  chatId: string,
  instruction: string,
  contextInfo: string,
  llmRouter: LLMRouter
): Promise<string> {
  // Build the prompt
  const prompt = buildPrompt(instruction, contextInfo);

  try {
    // Call AI service with dev mode
    const response = await llmRouter.processDeveloperMessage(chatId, prompt);

    // Parse response for patches
    const patches = parsePatches(response.text);

    // Create patch records if we have a project context
    const ctx = getProjectContext(chatId);
    if (ctx && patches.length > 0) {
      for (const patch of patches) {
        const originalContent = readFile(ctx.rootPath, patch.filePath) || '';
        createPatch(
          chatId,
          patch.filePath,
          originalContent,
          patch.content,
          patch.description
        );
      }

      // Add patch info to response
      const patchInfo = patches.length > 0
        ? `\n\n📝 ${patches.length} patch(es) aangemaakt. Gebruik /patch om te bekijken en toe te passen.`
        : '';

      return response.text + patchInfo;
    }

    return response.text;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Code task execution failed', { error: errorMessage, chatId });
    throw error;
  }
}

/**
 * Build prompt with context
 */
function buildPrompt(instruction: string, contextInfo: string): string {
  const parts: string[] = [];

  if (contextInfo) {
    parts.push('=== PROJECT CONTEXT ===');
    parts.push(contextInfo);
    parts.push('=== EINDE CONTEXT ===');
    parts.push('');
  }

  parts.push('=== OPDRACHT ===');
  parts.push(instruction);

  return parts.join('\n');
}

/**
 * Parse patches from AI response
 */
interface ParsedPatch {
  filePath: string;
  content: string;
  description: string;
  isNew: boolean;
}

function parsePatches(response: string): ParsedPatch[] {
  const patches: ParsedPatch[] = [];

  // Match ```patch:path or ```new:path patterns
  const patchRegex = /```(patch|new):([^\n]+)\n([\s\S]*?)```/g;
  let match;

  while ((match = patchRegex.exec(response)) !== null) {
    const [, type, filePath, content] = match;

    // Extract description from first line if it starts with ---
    let description = `${type === 'new' ? 'Nieuw bestand' : 'Wijziging'}: ${filePath}`;
    let actualContent = content;

    const lines = content.split('\n');
    if (lines[0]?.startsWith('---')) {
      description = lines[0].replace(/^-+\s*/, '').replace(/\s*-+$/, '').trim();
      actualContent = lines.slice(1).join('\n');
    }

    patches.push({
      filePath: filePath.trim(),
      content: actualContent.trim(),
      description,
      isNew: type === 'new',
    });
  }

  return patches;
}

/**
 * Generate a diff between two strings
 */
export function generateDiff(original: string, modified: string): string {
  const origLines = original.split('\n');
  const modLines = modified.split('\n');

  const diff: string[] = [];
  const maxLen = Math.max(origLines.length, modLines.length);

  let contextBuffer: string[] = [];
  let inDiff = false;

  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i];
    const modLine = modLines[i];

    if (origLine === modLine) {
      if (inDiff) {
        // Add context line after diff
        contextBuffer.push(` ${origLine || ''}`);
        if (contextBuffer.length >= 3) {
          diff.push(...contextBuffer.slice(0, 3));
          diff.push('...');
          contextBuffer = [];
          inDiff = false;
        }
      } else {
        // Store for potential context before diff
        contextBuffer.push(` ${origLine || ''}`);
        if (contextBuffer.length > 3) {
          contextBuffer.shift();
        }
      }
    } else {
      // Start of diff section
      if (!inDiff) {
        // Add context before
        diff.push(...contextBuffer);
        contextBuffer = [];
        inDiff = true;
      }

      if (origLine !== undefined) {
        diff.push(`-${origLine}`);
      }
      if (modLine !== undefined) {
        diff.push(`+${modLine}`);
      }
    }
  }

  return diff.join('\n');
}

/**
 * Apply a simple patch (replace entire file content)
 */
export function applySimplePatch(
  original: string,
  patch: string
): string {
  // For now, just return the patch content as the new file
  // In the future, we could implement proper unified diff application
  return patch;
}
