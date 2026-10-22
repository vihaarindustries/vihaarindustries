import 'server-only';

/**
 * OPTIONAL live tracking, one small adapter per courier.
 *
 * Today the site does not need any of this: each order stores the courier name, tracking number
 * and a tracking link built from the courier's saved link format (Control room → Couriers).
 * Customers open the courier's own page from the Track Order screen.
 *
 * If you later want status events to appear on your own tracking page, add an adapter below for
 * ONLY the couriers that offer an API. Couriers without an adapter keep working through the link.
 * Key = the courier name exactly as saved in Control room → Couriers.
 */
export type TrackingEvent = { status: string; location?: string; updatedAt: string };
export type CourierAdapter = { fetchTracking(trackingNumber: string): Promise<TrackingEvent[]> };

const ADAPTERS: Record<string, CourierAdapter> = {
  // 'Delhivery': { async fetchTracking(awb) { /* call Delhivery's tracking API with your account token */ return []; } },
  // 'DHL Express': { async fetchTracking(no) { /* call DHL's tracking API with your API key */ return []; } },
};

export const hasLiveTracking = (courier: string) => Object.prototype.hasOwnProperty.call(ADAPTERS, courier);

export async function fetchTracking(courier: string, trackingNumber: string): Promise<TrackingEvent[]> {
  const a = Object.prototype.hasOwnProperty.call(ADAPTERS, courier) ? ADAPTERS[courier] : undefined;
  if (!a) throw new Error('LIVE_TRACKING_NOT_AVAILABLE');
  return a.fetchTracking(trackingNumber);
}
