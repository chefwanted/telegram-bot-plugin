/**
 * Files storage tests
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('files storage', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tbp-files-'));
    process.env.FILES_DIR = path.join(tempDir, 'files');
    process.env.DATABASE_PATH = path.join(tempDir, 'bot.db');
    jest.resetModules();
  });

  afterEach(() => {
    const { closeDatabase } = require('../../../src/database');
    closeDatabase();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('saves and deletes file by file_id', () => {
    const { saveFile, deleteFile, getUserFiles } = require('../../../src/features/files/files');

    const data = Buffer.from('hello');
    const saved = saveFile('chat1', 'test.txt', data, 'text/plain');

    expect(fs.existsSync(saved.filePath)).toBe(true);

    const files = getUserFiles('chat1');
    expect(files).toHaveLength(1);
    expect(files[0].id).toBe(saved.id);

    const deleted = deleteFile(saved.id, 'chat1');
    expect(deleted).toBe(true);
    expect(fs.existsSync(saved.filePath)).toBe(false);
  });
});
