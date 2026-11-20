import { applyStockVersion, ConcurrentStockUpdateError, Stock } from '../../src/domain/inventory';
describe('concurrent inventory reservations', () => {
  it('allows only one contender to consume the final unit at a given version', async () => {
    let shared: Stock = { productId: 'limited', available: 1, version: 7 };
    const attempt = async () => {
      const expectedVersion = shared.version;
      const next = applyStockVersion(shared, expectedVersion, 1);
      await Promise.resolve();
      if (shared.version !== expectedVersion)
        throw new ConcurrentStockUpdateError(shared.productId);
      shared = next;
      return shared;
    };
    const results = await Promise.allSettled([attempt(), attempt()]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(shared.available).toBe(0);
  });
});
