'use client';
import { useEffect, useState } from 'react';
import { Alert, Badge, Card, PageHeader, Spinner } from '@/components/admin/ui';
import { api, errMsg } from '@/lib/admin/client';

type I = { key: string; name: string; purpose: string; env: string[]; docs?: string; status: 'live' | 'placeholder'; connected: boolean };
export default function Page() {
  const [rows, setRows] = useState<I[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { api<I[]>('/api/admin/integrations').then(setRows).catch((e) => setErr(errMsg(e))); }, []);
  return <div><PageHeader title="Integrations" subtitle="Outside services the website can connect to. Secret keys are added by your developer in the hosting environment, never in this screen." />
    {err && <Alert tone="error">{err}</Alert>}{!rows && !err && <Spinner />}
    <div className="grid md:grid-cols-2 gap-4">{rows?.map((i) => <Card key={i.key}>
      <div className="flex items-start justify-between gap-3"><h3 className="font-black">{i.name}</h3><Badge tone={i.connected ? 'green' : 'gray'}>{i.connected ? 'Connected' : 'Not connected'}</Badge></div>
      <p className="text-sm muted mt-1.5">{i.purpose}</p>
      <div className="mt-3 text-xs"><span className="font-bold">Needs: </span>{i.env.map((e) => <code key={e} className="bg-gray-100 rounded px-1.5 py-0.5 mr-1.5">{e}</code>)}</div>
      <div className="mt-2 text-xs muted">{i.status === 'placeholder' ? 'Placeholder: code hooks are ready, the provider call is still to be added.' : 'Ready to use once the keys are set.'}{i.docs && <> <a href={i.docs} target="_blank" rel="noreferrer noopener" className="underline">Docs</a></>}</div>
    </Card>)}</div></div>;
}
