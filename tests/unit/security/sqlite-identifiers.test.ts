/**
 * SQLite identifier validation tests
 */

import { describe, it, expect } from '@jest/globals';

describe('sqlite identifiers', () => {
  it('accepts safe identifiers and quotes them', () => {
    const { assertSqliteIdentifier, quoteSqliteIdentifier } = require('../../../src/database/sqlite');

    expect(assertSqliteIdentifier('sessions')).toBe('sessions');
    expect(assertSqliteIdentifier('_tbl1')).toBe('_tbl1');
    expect(quoteSqliteIdentifier('sessions')).toBe('"sessions"');
  });

  it('rejects unsafe identifiers', () => {
    const { assertSqliteIdentifier } = require('../../../src/database/sqlite');

    expect(() => assertSqliteIdentifier('')).toThrow();
    expect(() => assertSqliteIdentifier('1abc')).toThrow();
    expect(() => assertSqliteIdentifier('a-b')).toThrow();
    expect(() => assertSqliteIdentifier('sessions; DROP TABLE sessions;')).toThrow();
  });
});

