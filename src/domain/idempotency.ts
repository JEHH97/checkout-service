import { createHash } from 'node:crypto';
export type StoredResponse<T> = { requestHash: string; status: number; body: T };
export class IdempotencyConflictError extends Error {
  constructor() {
    super('Idempotency key was already used with a different request');
    this.name = 'IdempotencyConflictError';
  }
}
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export function replayOrConflict<T>(
  stored: StoredResponse<T> | undefined,
  request: unknown,
): StoredResponse<T> | undefined {
  if (!stored) return undefined;
  if (stored.requestHash !== fingerprint(request)) throw new IdempotencyConflictError();
  return stored;
}
