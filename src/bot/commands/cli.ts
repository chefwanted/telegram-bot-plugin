/**
 * CLI Command Handlers
 * Direct shortcuts for running Claude CLI and OpenCode CLI from the bot
 */

import { spawn } from 'child_process';
import type { ApiMethods } from '../../api';
import type { Message } from '../../types/telegram';

interface CliResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

/**
 * Execute a CLI command with timeout
 */
async function executeCli(
  command: string,
  args: string[],
  timeoutSeconds: number = 120
): Promise<CliResult> {
  const startTime = Date.now();

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const proc = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const timeoutMs = timeoutSeconds * 1000;
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      resolve({
        success: false,
        output: stdout,
        error: `Timeout after ${timeoutSeconds}s`,
        duration: Date.now() - startTime,
      });
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      resolve({
        success: code === 0,
        output: stdout,
        error: code !== 0 ? stderr : undefined,
        duration: Date.now() - startTime,
      });
    });

    proc.on('error', (error) => {
      clearTimeout(timeout);
      resolve({
        success: false,
        output: stdout,
        error: error.message,
        duration: Date.now() - startTime,
      });
    });
  });
}

/**
 * Claude CLI command handler
 * Usage: /claude-cli <prompt>
 */
export async function claudeCliCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length === 0) {
    const help = `
*Claude CLI*

Gebruik: /claude-cli <vraag>

Voorbeeld:
/claude-cli "Wat is 2+2?"
/claude-cli "Leg dit bestand uit" (met focus op een bestand)

*Tip:* Gebruik /focus <bestand> eerst voor context.
    `.trim();
    await api.sendText(chatId, help, { parse_mode: 'Markdown' });
    return;
  }

  const prompt = args.join(' ');
  await api.sendText(chatId, '🤖 *Claude CLI* wordt uitgevoerd...', { parse_mode: 'Markdown' });

  // Auto-add -p --print --output-format text for non-interactive use
  const fullArgs = ['-p', ...args, '--output-format', 'text'];
  const result = await executeCli('claude', fullArgs, 120);

  if (result.success) {
    const response = `✅ *Claude CLI* (${result.duration}ms)\n\n${result.output}`;
    await api.sendText(chatId, response, { parse_mode: 'Markdown' });
  } else {
    const response = `❌ *Claude CLI Error* (${result.duration}ms)\n\n${result.error || 'Unknown error'}\n\nOutput:\n${result.output}`;
    await api.sendText(chatId, response, { parse_mode: 'Markdown' });
  }
}

/**
 * OpenCode CLI command handler
 * Usage: /omo <prompt>
 */
export async function omoCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length === 0) {
    const help = `
*OpenCode CLI (omo)*

Gebruik: /omo <opdracht>

Voorbeeld:
/omo "Schrijf een fibonacci functie"
/omo "Maak een TODO lijst component"

*Tip:* Gebruik /focus <bestand> eerst voor context.
    `.trim();
    await api.sendText(chatId, help, { parse_mode: 'Markdown' });
    return;
  }

  const prompt = args.join(' ');
  await api.sendText(chatId, '🔧 *OpenCode CLI* wordt uitgevoerd...', { parse_mode: 'Markdown' });

  const result = await executeCli('omo', args, 120);

  if (result.success) {
    const response = `✅ *OpenCode CLI* (${result.duration}ms)\n\n${result.output}`;
    await api.sendText(chatId, response, { parse_mode: 'Markdown' });
  } else {
    const response = `❌ *OpenCode CLI Error* (${result.duration}ms)\n\n${result.error || 'Unknown error'}\n\nOutput:\n${result.output}`;
    await api.sendText(chatId, response, { parse_mode: 'Markdown' });
  }
}

/**
 * Default command descriptions for CLI commands
 */
export const CLI_COMMANDS: Record<string, string> = {
  '/claude-cli': '🤖 Claude CLI direct',
  '/omo': '🔧 OpenCode CLI direct',
};
