export type Stock = { productId: string; available: number; version: number };
export type Reservation = { productId: string; quantity: number; nextStock: Stock };
export class InsufficientStockError extends Error {
  constructor(productId: string, requested: number, available: number) {
    super(`Insufficient stock for ${productId}: requested ${requested}, available ${available}`);
    this.name = 'InsufficientStockError';
  }
}
export class ConcurrentStockUpdateError extends Error {
  constructor(productId: string) {
    super(`Stock changed concurrently for ${productId}`);
    this.name = 'ConcurrentStockUpdateError';
  }
}
export function reserveStock(stock: Stock, quantity: number): Reservation {
  if (!Number.isInteger(quantity) || quantity <= 0)
    throw new RangeError('Quantity must be a positive integer');
  if (stock.available < quantity)
    throw new InsufficientStockError(stock.productId, quantity, stock.available);
  return {
    productId: stock.productId,
    quantity,
    nextStock: { ...stock, available: stock.available - quantity, version: stock.version + 1 },
  };
}
export function applyStockVersion(
  current: Stock,
  expectedVersion: number,
  quantity: number,
): Stock {
  if (current.version !== expectedVersion) throw new ConcurrentStockUpdateError(current.productId);
  return reserveStock(current, quantity).nextStock;
}
