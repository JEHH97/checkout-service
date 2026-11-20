import {
  canTransition,
  InvalidOrderTransitionError,
  OrderState,
  transitionOrder,
} from '../../src/domain/order-state';
describe('order state machine', () => {
  it('accepts the payment lifecycle and rejects terminal-state changes', () => {
    expect(transitionOrder(OrderState.Pending, OrderState.AwaitingPayment)).toBe(
      OrderState.AwaitingPayment,
    );
    expect(transitionOrder(OrderState.AwaitingPayment, OrderState.Paid)).toBe(OrderState.Paid);
    expect(transitionOrder(OrderState.Paid, OrderState.Fulfilled)).toBe(OrderState.Fulfilled);
    expect(transitionOrder(OrderState.Paid, OrderState.Refunded)).toBe(OrderState.Refunded);
    expect(canTransition(OrderState.Cancelled, OrderState.Paid)).toBe(false);
    expect(() => transitionOrder(OrderState.Cancelled, OrderState.Paid)).toThrow(
      InvalidOrderTransitionError,
    );
  });
  it('allows cancellation before payment only', () => {
    expect(canTransition(OrderState.Pending, OrderState.Cancelled)).toBe(true);
    expect(canTransition(OrderState.AwaitingPayment, OrderState.Cancelled)).toBe(true);
    expect(canTransition(OrderState.Fulfilled, OrderState.Cancelled)).toBe(false);
  });
});
