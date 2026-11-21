export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db: number;
  tls?: Record<string, never>;
  maxRetriesPerRequest: null;
}

// Parses REDIS_URL into BullMQ connection options. The URL path selects the logical
// database index (for example redis://host:6379/1); an empty path means database 0.
export function redisConnectionFromUrl(value: string): RedisConnectionOptions {
  const url = new URL(value);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    db: redisDatabaseIndex(url.pathname),
    tls: url.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

function redisDatabaseIndex(pathname: string): number {
  const path = pathname.replace(/^\//, '');
  if (path === '') {
    return 0;
  }
  if (!/^\d+$/.test(path)) {
    throw new Error('REDIS_URL path must be a numeric database index, for example /1');
  }
  return Number(path);
}
