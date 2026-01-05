/**
 * Live validation script (no mocks): exercises real Telegram + LLM APIs.
 *
 * Required:
 * - TELEGRAM_BOT_TOKEN (or BOT_TOKEN)
 * - LIVE_TEST_CHAT_ID (Telegram chat ID to send/delete a test message)
 *
 * Optional:
 * - DATABASE_DIR or DATABASE_PATH (for DB operations)
 * - LIVE_DB_PATH (override DB path for live validation)
 * - ZAI_API_KEY / MINIMAX_API_KEY / MISTRAL_API_KEY (LLM providers)
 */

import 'dotenv/config';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { Bot } from 'grammy';
import { ApiMethods } from '../src/api/methods';
import { DatabaseClient } from '../src/database/client';
import { ZAIService } from '../src/zai';
import { MiniMaxService } from '../src/minimax';
import { MistralService } from '../src/mistral';
import { redactSensitive } from '../src/utils/redact';

type CheckResult = { name: string; ok: boolean; detail?: string };

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

function requiredEnv(name: string): string {
  const value = env(name);
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const results: CheckResult[] = [];

  const botToken = env('TELEGRAM_BOT_TOKEN') || env('BOT_TOKEN');
  if (!botToken) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN (or BOT_TOKEN)');
  }
  const chatId = requiredEnv('LIVE_TEST_CHAT_ID');

  const api = new ApiMethods(new Bot(botToken).api, { token: botToken, apiRoot: env('API_BASE_URL') });

  // Telegram getMe
  try {
    const me = await api.getMe();
    results.push({ name: 'telegram:getMe', ok: true, detail: `@${me.username}` });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name: 'telegram:getMe', ok: false, detail });
  }

  // Telegram send/delete message
  try {
    const sent = await api.sendMessage({
      chat_id: chatId,
      text: `✅ Live validation ping (${new Date().toISOString()})`,
    });
    await api.deleteMessage(chatId, sent.message_id);
    results.push({ name: 'telegram:send/delete', ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name: 'telegram:send/delete', ok: false, detail });
  }

  // Database CRUD (local, no mocks)
  try {
    const dbLockDir = env('DATABASE_DIR');
    const livePath = env('LIVE_DB_PATH')
      || env('DATABASE_PATH')
      || path.join(dbLockDir || os.tmpdir(), `tbp-live-${Date.now()}.db`);
    const cleanup = !env('LIVE_DB_PATH') && !env('DATABASE_PATH');

    const db = new DatabaseClient(livePath);
    const noteId = db.addNote('live-chat', 'live-validate', 'live');
    const notes = db.getNotes('live-chat');
    const found = notes.some(n => n.id === noteId);
    if (!found) {
      throw new Error('Note insert/read failed');
    }
    db.deleteNote(noteId, 'live-chat');
    db.close();

    if (cleanup && fs.existsSync(livePath)) {
      fs.unlinkSync(livePath);
    }

    results.push({ name: 'db:notes-crud', ok: true });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name: 'db:notes-crud', ok: false, detail });
  }

  // LLM providers (real calls if keys configured)
  const llmChecks: Array<Promise<CheckResult>> = [];

  const zaiKey = env('ZAI_API_KEY');
  if (zaiKey) {
    llmChecks.push((async () => {
      try {
        const service = new ZAIService({ apiKey: zaiKey, model: env('ZAI_MODEL') });
        const response = await service.processMessage('live-validate', 'Ping: respond with OK');
        return { name: 'llm:zai', ok: Boolean(response.text) };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return { name: 'llm:zai', ok: false, detail };
      }
    })());
  }

  const miniMaxKey = env('MINIMAX_API_KEY');
  if (miniMaxKey) {
    llmChecks.push((async () => {
      try {
        const service = new MiniMaxService({ apiKey: miniMaxKey, model: env('MINIMAX_MODEL') });
        const response = await service.processMessage('live-validate', 'Ping: respond with OK');
        return { name: 'llm:minimax', ok: Boolean(response.text) };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return { name: 'llm:minimax', ok: false, detail };
      }
    })());
  }

  const mistralKey = env('MISTRAL_API_KEY');
  if (mistralKey) {
    llmChecks.push((async () => {
      try {
        const service = new MistralService({ apiKey: mistralKey, model: env('MISTRAL_MODEL') });
        const response = await service.processMessage('live-validate', 'Ping: respond with OK');
        return { name: 'llm:mistral', ok: Boolean(response.text) };
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return { name: 'llm:mistral', ok: false, detail };
      }
    })());
  }

  if (llmChecks.length === 0) {
    results.push({ name: 'llm:providers', ok: false, detail: 'No API keys configured' });
  } else {
    results.push(...(await Promise.all(llmChecks)));
  }

  const failed = results.filter(r => !r.ok);
  const summary = {
    ok: failed.length === 0,
    results,
  };

  const redacted = redactSensitive(summary);
  process.stdout.write(`${JSON.stringify(redacted, null, 2)}\n`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  process.stderr.write(`live-validate failed: ${detail}\n`);
  process.exitCode = 1;
});
