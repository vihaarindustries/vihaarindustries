'use client';
import { Alert, PageHeader } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';

export default function Page() {
  return <div><PageHeader title="Couriers" subtitle="The shipping companies you use. Tick which deliveries each one handles, and save its tracking-link format once so every order gets a working tracking link automatically." />
    <div className="mb-4"><Alert tone="info">To get a link format: open the courier&apos;s own tracking page, track any number, and copy the address from the browser. Paste it here and replace the tracking number in it with <code>{'{tracking}'}</code>. Example: <code>{'https://www.fedex.com/fedextrack/?trknbr={tracking}'}</code>. If a courier has no format saved, you can still paste the link by hand on each order.</Alert></div>
    <ResourceManager resource="couriers" />
  </div>;
}
