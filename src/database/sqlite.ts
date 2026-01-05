/**
 * SQLite helpers for safely embedding identifiers (table/column names).
 *
 * SQL parameters cannot be used for identifiers, so we must validate before interpolation.
 */

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertSqliteIdentifier(name: string, kind: string = 'identifier'): string {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(`Invalid SQLite ${kind}: empty`);
  }
  if (trimmed.length > 64) {
    throw new Error(`Invalid SQLite ${kind}: too long`);
  }
  if (!IDENTIFIER_RE.test(trimmed)) {
    throw new Error(`Invalid SQLite ${kind}: ${name}`);
  }
  return trimmed;
}

export function quoteSqliteIdentifier(name: string, kind?: string): string {
  const safe = assertSqliteIdentifier(name, kind);
  return `"${safe}"`;
}

