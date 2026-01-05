/**
 * Database path validation tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('database path lockdown', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbp-db-lock-'));
    delete process.env.ALLOW_UNSAFE_DATABASE_PATH;
    jest.resetModules();
  });

  afterEach(() => {
    delete process.env.DATABASE_DIR;
    delete process.env.DATABASE_PATH;
    delete process.env.ALLOW_UNSAFE_DATABASE_PATH;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects DATABASE_PATH outside DATABASE_DIR when locked', async () => {
    process.env.DATABASE_DIR = tempDir;
    process.env.DATABASE_PATH = '/etc/passwd';

    await expect(import('../../../src/database/client')).rejects.toThrow(/DATABASE_PATH must be within/);
  });

  it('allows DATABASE_PATH within DATABASE_DIR when locked', async () => {
    process.env.DATABASE_DIR = tempDir;
    process.env.DATABASE_PATH = path.join(tempDir, 'bot.db');

    await expect(import('../../../src/database/client')).resolves.toBeDefined();
  });
});

