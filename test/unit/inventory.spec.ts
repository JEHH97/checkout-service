import {
  applyStockVersion,
  InsufficientStockError,
  reserveStock,
} from '../../src/domain/inventory';
describe('inventory reservation', () => {
  it('reduces availability and increments the optimistic version', () => {
    expect(reserveStock({ productId: 'p1', available: 5, version: 2 }, 3).nextStock).toEqual({
      productId: 'p1',
      available: 2,
      version: 3,
    });
  });
  it('rejects overselling and stale writes', () => {
    expect(() => reserveStock({ productId: 'p1', available: 1, version: 0 }, 2)).toThrow(
      InsufficientStockError,
    );
    expect(() => applyStockVersion({ productId: 'p1', available: 2, version: 4 }, 3, 1)).toThrow(
      'concurrently',
    );
  });
  it('rejects non-positive quantities', () => {
    expect(() => reserveStock({ productId: 'p1', available: 1, version: 0 }, 0)).toThrow(
      RangeError,
    );
  });
});
