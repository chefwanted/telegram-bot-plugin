export interface RateLimitDecision {
  allowed: boolean;
  retryAfterMs?: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  check(key: string, limit: number, windowMs: number): RateLimitDecision {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }

    if (existing.count >= limit) {
      return { allowed: false, retryAfterMs: Math.max(0, existing.resetAt - now) };
    }

    existing.count++;
    return { allowed: true };
  }

  sweep(maxAgeMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.resetAt > maxAgeMs) {
        this.buckets.delete(key);
      }
    }
  }
}

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRateLimitConfig(): {
  commands: { limit: number; windowMs: number };
  messages: { limit: number; windowMs: number };
  uploads: { limit: number; windowMs: number };
} {
  return {
    commands: {
      limit: readIntEnv('RATE_LIMIT_COMMANDS', 10),
      windowMs: readIntEnv('RATE_LIMIT_COMMANDS_WINDOW_MS', 10_000),
    },
    messages: {
      limit: readIntEnv('RATE_LIMIT_MESSAGES', 20),
      windowMs: readIntEnv('RATE_LIMIT_MESSAGES_WINDOW_MS', 10_000),
    },
    uploads: {
      limit: readIntEnv('RATE_LIMIT_UPLOADS', 3),
      windowMs: readIntEnv('RATE_LIMIT_UPLOADS_WINDOW_MS', 60_000),
    },
  };
}

