export enum OrderState {
  Pending = 'pending',
  AwaitingPayment = 'awaiting_payment',
  Paid = 'paid',
  Fulfilled = 'fulfilled',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
}
const transitions: Readonly<Record<OrderState, readonly OrderState[]>> = {
  [OrderState.Pending]: [OrderState.AwaitingPayment, OrderState.Cancelled],
  [OrderState.AwaitingPayment]: [OrderState.Paid, OrderState.Cancelled],
  [OrderState.Paid]: [OrderState.Fulfilled, OrderState.Refunded],
  [OrderState.Fulfilled]: [OrderState.Refunded],
  [OrderState.Cancelled]: [],
  [OrderState.Refunded]: [],
};
export class InvalidOrderTransitionError extends Error {
  constructor(from: OrderState, to: OrderState) {
    super(`Cannot transition order from ${from} to ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}
export function canTransition(from: OrderState, to: OrderState): boolean {
  return transitions[from].includes(to);
}
export function transitionOrder(from: OrderState, to: OrderState): OrderState {
  if (!canTransition(from, to)) throw new InvalidOrderTransitionError(from, to);
  return to;
}
