/**
 * Input validation tests
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('input validation', () => {
  beforeEach(() => {
    delete process.env.MAX_UPLOAD_BYTES;
  });

  afterEach(() => {
    delete process.env.MAX_UPLOAD_BYTES;
  });

  it('strips unsafe control characters', () => {
    const { validateIncomingText } = require('../../../src/utils/input-validation');
    const result = validateIncomingText(`a\u0000b\tc\n`);
    expect(result.ok).toBe(true);
    expect(result.value).toBe('ab\tc\n');
  });

  it('rejects empty input', () => {
    const { validateIncomingText } = require('../../../src/utils/input-validation');
    const result = validateIncomingText('');
    expect(result.ok).toBe(false);
  });

  it('enforces max length', () => {
    const { validateIncomingText } = require('../../../src/utils/input-validation');
    const result = validateIncomingText('x'.repeat(11), 10);
    expect(result.ok).toBe(false);
  });

  it('reads MAX_UPLOAD_BYTES with a safe fallback', () => {
    const { getMaxUploadBytes } = require('../../../src/utils/input-validation');

    expect(getMaxUploadBytes(123)).toBe(123);

    process.env.MAX_UPLOAD_BYTES = '2048';
    expect(getMaxUploadBytes(123)).toBe(2048);

    process.env.MAX_UPLOAD_BYTES = '-1';
    expect(getMaxUploadBytes(123)).toBe(123);
  });
});

