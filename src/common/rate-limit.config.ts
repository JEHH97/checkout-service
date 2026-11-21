export interface RateLimitConfig {
  ttl: number;
  globalLimit: number;
  authLimit: number;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function rateLimitConfig(env: NodeJS.ProcessEnv = process.env): RateLimitConfig {
  const isTest = env.NODE_ENV === 'test';
  return {
    ttl: positiveInteger(env.THROTTLE_TTL_MS, 60_000),
    globalLimit: positiveInteger(env.THROTTLE_LIMIT, isTest ? 10_000 : 120),
    authLimit: positiveInteger(env.AUTH_THROTTLE_LIMIT, isTest ? 1_000 : 8),
  };
}
