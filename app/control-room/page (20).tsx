'use client';
import { Alert, PageHeader } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';

export default function Page() {
  return <div><PageHeader title="Audit log" subtitle="A permanent record of who changed what. Entries cannot be edited or deleted by anyone." />
    <div className="mb-4"><Alert tone="info">Sign-ins, data exports, price changes, stock, orders, payments and access changes are recorded here.</Alert></div>
    <ResourceManager resource="audit_logs" /></div>;
}
