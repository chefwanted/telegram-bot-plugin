/**
 * Custom Tools Feature
 * Allows users to add custom scripts and tools via the bot
 * Supports OpenCode CLI (omo) and Claude CLI (claude)
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type { ApiMethods } from '../../api';
import type { Message } from '../../types/telegram';
import { createLogger } from '../../utils/logger';

const logger = createLogger({ prefix: 'CustomTools' });

// =============================================================================
// Special CLI Commands (allowed even if not found by 'which')
// =============================================================================

const SPECIAL_CLI_COMMANDS = ['omo', 'claude', 'npm', 'node', 'npx'];

/**
 * Check if a command is a special CLI that should be allowed
 */
function isSpecialCLI(command: string): boolean {
  return SPECIAL_CLI_COMMANDS.includes(command.toLowerCase());
}

/**
 * Check if command exists (handles special CLIs)
 */
async function commandExists(command: string): Promise<boolean> {
  // Always allow special CLIs
  if (isSpecialCLI(command)) {
    return true;
  }

  // Use 'which' for regular commands
  return new Promise((resolve) => {
    const proc = spawn('which', [command]);
    proc.on('close', (code) => {
      resolve(code === 0);
    });
    proc.on('error', () => {
      resolve(false);
    });
  });
}

// =============================================================================
// Custom Tool Types
// =============================================================================

export interface CustomTool {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  workingDir?: string;
  timeout: number; // in seconds
  enabled: boolean;
  createdAt: Date;
  createdBy: number; // user id
  isCliTool?: boolean; // mark as CLI tool (omo, claude, etc.)
}

interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  duration: number;
}

// =============================================================================
// Custom Tools Storage
// =============================================================================

const CUSTOM_TOOLS_DIR = '/tmp/custom-tools';
const TOOLS_FILE = path.join(CUSTOM_TOOLS_DIR, 'tools.json');

function ensureToolsDir(): void {
  if (!fs.existsSync(CUSTOM_TOOLS_DIR)) {
    fs.mkdirSync(CUSTOM_TOOLS_DIR, { recursive: true });
  }
}

function loadTools(): Record<string, CustomTool> {
  ensureToolsDir();
  if (!fs.existsSync(TOOLS_FILE)) {
    return {};
  }
  try {
    const data = fs.readFileSync(TOOLS_FILE, 'utf-8');
    const tools = JSON.parse(data);
    // Convert dates back
    for (const id in tools) {
      tools[id].createdAt = new Date(tools[id].createdAt);
    }
    return tools;
  } catch {
    return {};
  }
}

function saveTools(tools: Record<string, CustomTool>): void {
  ensureToolsDir();
  fs.writeFileSync(TOOLS_FILE, JSON.stringify(tools, null, 2));
}

// =============================================================================
// Tool Execution
// =============================================================================

export async function executeCustomTool(
  api: ApiMethods,
  message: Message,
  toolId: string,
  args: string[]
): Promise<ToolResult> {
  const tools = loadTools();
  const tool = tools[toolId];

  if (!tool) {
    return { success: false, output: '', error: 'Tool not found', duration: 0 };
  }

  if (!tool.enabled) {
    return { success: false, output: '', error: 'Tool is disabled', duration: 0 };
  }

  const startTime = Date.now();

  try {
    // Add special flags for CLI tools
    let fullArgs = [...tool.args, ...args];
    const workingDir = tool.workingDir || process.cwd();

    // Claude needs -p flag for non-interactive use
    if (tool.isCliTool && tool.command.toLowerCase() === 'claude') {
      // Add -p if not already present
      if (!fullArgs.includes('-p') && !fullArgs.includes('--print')) {
        fullArgs = ['-p', ...fullArgs];
      }
      // Add --output-format text for cleaner output
      if (!fullArgs.includes('--output-format')) {
        fullArgs.push('--output-format', 'text');
      }
    }

    logger.info('Executing custom tool', { tool: tool.name, args: fullArgs });

    const result = await new Promise<ToolResult>((resolve) => {
      const proc = spawn(tool.command, fullArgs, {
        cwd: workingDir,
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      const timeoutMs = tool.timeout * 1000;
      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        resolve({
          success: false,
          output: stdout,
          error: `Timeout after ${tool.timeout}s`,
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

    return result;
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
}

// =============================================================================
// Tool Management Commands
// =============================================================================

export async function toolAddCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;
  const userId = message.from?.id;

  if (!userId) {
    await api.sendText(chatId, 'Error: Could not identify user');
    return;
  }

  // Parse arguments: /tool add <name> <command> [description]
  if (args.length < 3) {
    const help = `
*Custom Tool Toevoegen*

Gebruik: /tool add <naam> <command> <beschrijving>

Voorbeeld:
/tool add hello echo "Hello World" - Print Hello World

Beschikbare placeholders:
{NAME} - Tool naam
{ARGS} - Alle argumenten
{ARG1}, {ARG2}, etc. - Individuele argumenten

Let op: Kommas in argumenten moeten escaped worden met \\
    `.trim();
    await api.sendText(chatId, help, { parse_mode: 'Markdown' });
    return;
  }

  const name = args[0];
  const command = args[1];
  const description = args.slice(2).join(' ');

  // Validate command exists (skip for special CLIs like omo, claude)
  const isSpecial = isSpecialCLI(command);

  if (!isSpecial) {
    const exists = await commandExists(command);
    if (!exists) {
      await api.sendText(chatId, `Error: Command '${command}' not found in PATH`);
      return;
    }
  }

  const tools = loadTools();
  const toolId = name.toLowerCase().replace(/\s+/g, '-');

  tools[toolId] = {
    id: toolId,
    name,
    description,
    command,
    args: [],
    timeout: isSpecial ? 120 : 30, // Give CLIs more time
    enabled: true,
    createdAt: new Date(),
    createdBy: userId,
    isCliTool: isSpecial,
  };

  saveTools(tools);

  await api.sendText(chatId, `✅ Custom tool '${name}' toegevoegd!` + (isSpecial ? '\n\n⏱️ Timeout: 120s (verhoogd voor CLI)' : '') + `\n\nGebruik: /tool run ${toolId} [args]`);
}

export async function toolListCommand(
  api: ApiMethods,
  message: Message
): Promise<void> {
  const chatId = message.chat.id;
  const tools = loadTools();
  const toolList = Object.values(tools);

  if (toolList.length === 0) {
    await api.sendText(chatId, 'Nog geen custom tools toegevoegd.\n\nGebruik /tool add <naam> <command> <beschrijving> om een tool toe te voegen.');
    return;
  }

  let text = '*Custom Tools (' + toolList.length + ')*\n\n';
  for (const tool of toolList) {
    const status = tool.enabled ? '✅' : '❌';
    text += status + ' /tool run ' + tool.id + ' - ' + tool.name + '\n';
    text += '   ' + tool.description + '\n';
    text += '   Command: ' + tool.command + '\n\n';
  }

  text += '\nGebruik /tool run <naam> [args] om een tool uit te voeren.';

  await api.sendText(chatId, text, { parse_mode: 'Markdown' });
}

export async function toolRunCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length < 1) {
    await api.sendText(chatId, 'Gebruik: /tool run <naam> [args]\n\nGebruik /tool list om beschikbare tools te zien.');
    return;
  }

  const toolId = args[0];
  const toolArgs = args.slice(1);

  await api.sendText(chatId, '⏳ Tool wordt uitgevoerd...');

  const result = await executeCustomTool(api, message, toolId, toolArgs);

  if (result.success) {
    const response = '✅ *Tool uitgevoerd* (' + result.duration + 'ms)\n\n' + result.output;
    await api.sendText(chatId, response, { parse_mode: 'Markdown' });
  } else {
    const response = '❌ *Tool failed* (' + result.duration + 'ms)\n\nError: ' + (result.error || 'Unknown error') + '\n\nOutput:\n' + result.output;
    await api.sendText(chatId, response, { parse_mode: 'Markdown' });
  }
}

export async function toolDeleteCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length < 1) {
    await api.sendText(chatId, 'Gebruik: /tool delete <naam>\n\nGebruik /tool list om tools te zien.');
    return;
  }

  const toolId = args[0];
  const tools = loadTools();

  if (!tools[toolId]) {
    await api.sendText(chatId, 'Error: Tool niet gevonden');
    return;
  }

  const toolName = tools[toolId].name;
  delete tools[toolId];
  saveTools(tools);

  await api.sendText(chatId, '✅ Tool "' + toolName + '" verwijderd.');
}

export async function toolToggleCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length < 2) {
    await api.sendText(chatId, 'Gebruik: /tool toggle <naam> on|off');
    return;
  }

  const toolId = args[0];
  const state = args[1].toLowerCase();
  const enabled = state === 'on' || state === 'true' || state === '1';

  const tools = loadTools();

  if (!tools[toolId]) {
    await api.sendText(chatId, 'Error: Tool niet gevonden');
    return;
  }

  tools[toolId].enabled = enabled;
  saveTools(tools);

  const status = enabled ? 'enabled' : 'disabled';
  await api.sendText(chatId, '✅ Tool "' + tools[toolId].name + '" is nu ' + status + '.');
}

export async function toolHelpCommand(api: ApiMethods, message: Message): Promise<void> {
  const chatId = message.chat.id;

  const help = `
*Custom Tools Help*

Met custom tools kun je eigen scripts en commando's toevoegen.

*Commando's:*
/tool add <naam> <command> <beschrijving> - Voeg tool toe
/tool list - Toon alle tools
/tool run <naam> [args] - Voer tool uit
/tool delete <naam> - Verwijder tool
/tool toggle <naam> on|off - Enable/disable tool
/tool help - Toon dit bericht

*Voorbeelden:*
/tool add date date "Toon huidige datum"
/tool run date
/tool add greet bash "echo Hello {NAME}" - Aangepaste greeting
/tool run greet World

*🤖 AI CLI Integratie:*

/tool add claude claude "Vraag Claude AI" - Start Claude CLI
/tool run claude "Explain this code" - Claude zal je vraag beantwoorden
/tool add omo omo "OpenCode CLI" - Start OpenCode CLI
/tool run omo "Write a function to calculate fibonacci" - OpenCode zal je helpen

*💡 Tips voor AI CLI:*
- Gebruik dubbele aanhalingstekens rond prompts met spaties
- AI CLI's krijgen 120s timeout (langer dan normale tools)
- Claude werkt het beste met korte, duidelijke prompts
- OpenCode kan complexe code genereren

*Variabelen:*
{NAME} - Tool naam
{ARGS} - Alle argumenten
{ARG1}, {ARG2} - Eerste, tweede argument
  `.trim();

  await api.sendText(chatId, help, { parse_mode: 'Markdown' });
}

// =============================================================================
// Master Tool Command Router
// =============================================================================

export async function customToolCommand(
  api: ApiMethods,
  message: Message,
  args: string[]
): Promise<void> {
  const chatId = message.chat.id;

  if (args.length === 0) {
    await toolHelpCommand(api, message);
    return;
  }

  const action = args[0].toLowerCase();
  const toolArgs = args.slice(1);

  switch (action) {
    case 'add':
    case 'create':
      await toolAddCommand(api, message, toolArgs);
      break;
    case 'list':
    case 'ls':
      await toolListCommand(api, message);
      break;
    case 'run':
    case 'exec':
    case 'execute':
      await toolRunCommand(api, message, toolArgs);
      break;
    case 'delete':
    case 'remove':
    case 'rm':
      await toolDeleteCommand(api, message, toolArgs);
      break;
    case 'toggle':
    case 'enable':
    case 'disable':
      await toolToggleCommand(api, message, toolArgs);
      break;
    case 'help':
    case '--help':
    case '-h':
      await toolHelpCommand(api, message);
      break;
    default:
      await api.sendText(chatId, 'Onbekende actie: ' + action + '\n\nGebruik /tool help voor hulp.');
  }
}
