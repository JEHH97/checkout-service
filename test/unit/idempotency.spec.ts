import {
  fingerprint,
  IdempotencyConflictError,
  replayOrConflict,
} from '../../src/domain/idempotency';
describe('idempotency records', () => {
  it('replays the stored response for an identical request', () => {
    const request = { productId: 'p1', quantity: 2 };
    const stored = { requestHash: fingerprint(request), status: 201, body: { id: 'o1' } };
    expect(replayOrConflict(stored, request)).toEqual(stored);
    expect(replayOrConflict(undefined, request)).toBeUndefined();
  });
  it('rejects reuse with a different payload', () => {
    const stored = { requestHash: fingerprint({ quantity: 1 }), status: 201, body: { id: 'o1' } };
    expect(() => replayOrConflict(stored, { quantity: 2 })).toThrow(IdempotencyConflictError);
  });
});
