'use client';
import { Alert, PageHeader } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';

export default function Page() {
  return <div><PageHeader title="Website sections" subtitle="Show, hide and reorder the sections of the Retail and Business pages, and change their headings." />
    <div className="mb-4"><Alert tone="info">Hidden sections disappear from the website straight away. Use <b>Reorder</b> to change the order they appear in. Keep at least one section visible.</Alert></div>
    <ResourceManager resource="site_sections" /></div>;
}
