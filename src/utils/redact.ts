const SENSITIVE_KEY_RE = /(token|api[-_]?key|authorization|password|secret)/i;

// Telegram bot tokens are typically like: 123456789:AA... (35+ chars after colon)
const TELEGRAM_TOKEN_RE = /\b\d{6,}:[A-Za-z0-9_-]{20,}\b/g;

function redactString(input: string): string {
  return input.replace(TELEGRAM_TOKEN_RE, '[REDACTED_TELEGRAM_TOKEN]');
}

export function redactSensitive(value: unknown, depth: number = 0): unknown {
  if (depth > 4) return '[REDACTED_DEPTH_LIMIT]';

  if (typeof value === 'string') return redactString(value);
  if (value == null) return value;
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    return value.map((v) => redactSensitive(v, depth + 1));
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '[REDACTED]';
      } else {
        out[key] = redactSensitive(v, depth + 1);
      }
    }
    return out;
  }

  return '[REDACTED_UNSUPPORTED]';
}

