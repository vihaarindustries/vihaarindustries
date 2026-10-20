import 'server-only';
/** PLACEHOLDER for the online payment gateway. Orders are created and paid manually in the control room until this is wired up. */
export type PaymentIntent = { id: string; checkoutUrl: string };
export async function createPaymentIntent(_orderId: string, _amountMinor: number, _currency = 'INR'): Promise<PaymentIntent> {
  void _orderId; void _amountMinor; void _currency;
  // TODO: call Razorpay Orders / Stripe Checkout here, return the hosted checkout URL.
  throw new Error('PAYMENTS_NOT_CONFIGURED');
}
/** TODO: verify the webhook signature with PAYMENT_WEBHOOK_SECRET, then call the record_payment database function with the service role. */
export async function handlePaymentWebhook(_rawBody: string, _signature: string): Promise<void> { void _rawBody; void _signature; throw new Error('PAYMENTS_NOT_CONFIGURED'); }
