'use client';
import { useState } from 'react';
import { PageHeader, Tabs, Alert } from '../ui';
import ResourceManager from '../ResourceManager';

export default function ShowcaseView() {
  const [tab, setTab] = useState('certificate');
  return <div>
    <PageHeader title="Certificates & achievements" subtitle="Add, remove and reorder the trust items shown on your website." />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'certificate', label: 'Certificates & licences' }, { key: 'achievement', label: 'Achievements' }, { key: 'award', label: 'Awards' }, { key: 'testimonials', label: 'Testimonials' }]} />
    <div className="mb-4"><Alert tone="info">Press <b>Reorder</b> to drag items into the order you want visitors to see. Items marked &ldquo;Show on website&rdquo; appear publicly; expired certificates hide themselves.</Alert></div>
    {tab === 'testimonials' ? <ResourceManager resource="testimonials" />
      : <ResourceManager key={tab} resource="certificates" fixedFilter={{ kind: tab }} createDefaults={{ kind: tab }} addLabel={tab === 'certificate' ? 'Add certificate' : tab === 'award' ? 'Add award' : 'Add achievement'} />}
  </div>;
}
