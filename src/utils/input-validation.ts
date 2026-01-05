export interface TextValidationResult {
  ok: boolean;
  value?: string;
  reason?: string;
}

function stripUnsafeControlChars(text: string): string {
  // Allow: tab (\t), newline (\n), carriage return (\r). Strip other C0 controls.
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
}

export function validateIncomingText(text: string, maxLength: number = 4096): TextValidationResult {
  const normalized = stripUnsafeControlChars(text);
  if (normalized.length === 0) {
    return { ok: false, reason: 'Leeg bericht.' };
  }
  if (normalized.length > maxLength) {
    return { ok: false, reason: `Bericht te lang (${normalized.length} > ${maxLength}).` };
  }
  return { ok: true, value: normalized };
}

export function getMaxUploadBytes(defaultBytes: number = 20 * 1024 * 1024): number {
  const raw = process.env.MAX_UPLOAD_BYTES?.trim();
  if (!raw) return defaultBytes;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultBytes;
  return parsed;
}

