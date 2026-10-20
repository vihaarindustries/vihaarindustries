import 'server-only';
/** PLACEHOLDER for a courier / shipping aggregator. Tracking details can be typed into the order screen meanwhile. */
export async function createShipment(_orderId: string): Promise<{ trackingNumber: string; trackingUrl: string }> { void _orderId; throw new Error('SHIPPING_NOT_CONFIGURED'); }
export async function fetchTracking(_courier: string, _trackingNumber: string): Promise<{ status: string; updatedAt: string }[]> { void _courier; void _trackingNumber; throw new Error('SHIPPING_NOT_CONFIGURED'); }
