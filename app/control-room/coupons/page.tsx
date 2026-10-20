'use client';
import { useState } from 'react';
import { Alert, PageHeader, Tabs } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';

export default function Page() {
  const [tab, setTab] = useState('coupons');
  return <div><PageHeader title="Coupons" subtitle="Discount codes, targeted by customer type instead of gender: retail, business or export buyers, with minimum order, caps, expiry and first-order rules." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'coupons', label: 'Coupons' }, { key: 'usage', label: 'Usage' }]} />
    {tab === 'coupons' ? <><div className="mb-4"><Alert tone="info">Codes are private: customers cannot browse them. A code is checked against the customer type, order value, products, expiry and usage limits when an order is created.</Alert></div><ResourceManager resource="promotions" /></> : <ResourceManager resource="promotion_redemptions" />}
  </div>;
}
