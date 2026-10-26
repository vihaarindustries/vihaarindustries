'use client';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Btn, Card, Input, Label, PageHeader, Select, Spinner, Table, Td, Th, useFlash } from '@/components/admin/ui';
import { useRole } from '@/components/admin/role';
import { api, errMsg, rpc } from '@/lib/admin/client';
import { type Ccy, type FxConfig, type FxSourceKey } from '@/lib/fx/currencies';

type Rate = { currency: string; source: string; rate_to_inr: number; rate_date: string; note: string | null };
type Src = { key: FxSourceKey; label: string; short: string; about: string; env: string | null; configured: boolean };
type Data = { currencies: Ccy[]; rates: Rate[]; config: FxConfig; sources: Src[]; schedule: boolean };
type Report = { source: string; label: string; configured: boolean; ok: boolean; saved: number; rate_date?: string; error?: string; warnings: string[] };

const MARKET = ['ecb', 'exchangerate_api', 'oxr'];
const today = () => new Date().toISOString().slice(0, 10);
const daysOld = (d: string) => Math.round((Date.now() - new Date(`${d}T00:00:00Z`).getTime()) / 86_400_000);
const niceDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export default function Page() {
  const role = useRole(); const canEditSite = role === 'owner' || role === 'admin';
  const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState('');
  const [busy, setBusy] = useState(''); const [report, setReport] = useState<Report[] | null>(null);
  const [cfg, setCfg] = useState<FxConfig | null>(null);
  const [m, setM] = useState({ currency: 'USD', rate: '', date: today(), note: '' });
  const { show, node } = useFlash();

  const load = useCallback(async () => { try { const d = await api<Data>('/api/admin/fx'); setData(d); setCfg(d.config); setErr(''); } catch (e) { setErr(errMsg(e)); } }, []);
  useEffect(() => { load(); }, [load]);

  async function refresh() {
    setBusy('refresh'); setReport(null);
    try { const r = await api<{ report: Report[] }>('/api/admin/fx', { method: 'POST', body: {} }); setReport(r.report); await load(); }
    catch (e) { show('error', errMsg(e)); } finally { setBusy(''); }
  }
  async function addManual() {
    setBusy('manual');
    try { await rpc('add_manual_rate', { p_currency: m.currency, p_rate: Number(m.rate), p_date: m.date, ...(m.note.trim() ? { p_note: m.note.trim() } : {}) }); setM({ ...m, rate: '', note: '' }); await load(); show('success', 'Rate saved. It can now be chosen when accepting an order.'); }
    catch (e) { show('error', errMsg(e)); } finally { setBusy(''); }
  }
  async function saveCfg() {
    if (!cfg) return; setBusy('cfg');
    try { await api('/api/admin/settings/fx_config', { method: 'PUT', body: { value: cfg } }); await load(); show('success', 'Website currency settings saved. Visitors see the change within about 15 minutes.'); }
    catch (e) { show('error', errMsg(e)); } finally { setBusy(''); }
  }

  if (!data && !err) return <Spinner />;
  const latest = (c: string, s: string) => data?.rates.find((r) => r.currency === c && r.source === s);
  const noRates = !!data && data.rates.length === 0;

  return <div>
    <PageHeader title="Currency rates" subtitle="Exchange rates from several sources. Rates are used when you accept an order in another currency, and for the approximate prices shown to website visitors. Your books stay in rupees." />
    {err && <div className="mb-4"><Alert tone="error">{err}{/relation|exchange_rates|schema/i.test(err) ? ' Has the database update (migration 018) been run?' : ''}</Alert></div>}
    {node && <div className="mb-4">{node}</div>}
    {data && !data.schedule && <div className="mb-4"><Alert tone="info"><b>Daily automatic refresh is off.</b> Press “Refresh rates now” when needed, or ask your developer to set <code>CRON_SECRET</code> so rates refresh by themselves every morning.</Alert></div>}

    {data && cfg && <div className="space-y-4">
      <Card title="Rate sources" action={<Btn busy={busy === 'refresh'} disabled={!!busy} onClick={refresh}>Refresh rates now</Btn>}>
        <ul className="divide-y divide-gray-100 -my-2">{data.sources.map((s) => <li key={s.key} className="py-3 flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="font-bold text-sm">{s.label}</div><div className="text-xs muted mt-0.5">{s.about}</div></div>
          {s.key === 'manual' ? <Badge>You enter these</Badge> : s.configured ? <Badge tone="green">Active</Badge> : <Badge tone="amber">Needs {s.env}</Badge>}</li>)}</ul>
        {report && <div className="mt-4 space-y-1.5 text-sm">{report.filter((r) => r.configured).map((r) => <div key={r.source} className={r.ok ? 'text-[#006b38]' : 'text-red-700'}>
          <b>{r.label}:</b> {r.ok ? `${r.saved} rates saved (rate date ${niceDate(r.rate_date ?? today())}).` : r.error ?? 'No rates saved.'}
          {r.warnings.map((w, i) => <div key={i} className="text-xs text-amber-700 pl-3">{w}</div>)}</div>)}</div>}
        {noRates && !report && <p className="text-sm text-amber-700 mt-4">No rates stored yet. Press “Refresh rates now” to fetch the first set.</p>}
      </Card>

      <Card title="Latest rates (₹ for 1 unit of each currency)">
        <Table><thead><tr><Th>Currency</Th>{data.sources.map((s) => <Th key={s.key} right>{s.short}</Th>)}<Th right>Difference</Th></tr></thead><tbody>
          {data.currencies.map((c) => {
            const vals = MARKET.map((s) => latest(c.code, s)?.rate_to_inr).filter((v): v is number => v !== undefined);
            const spread = vals.length > 1 ? ((Math.max(...vals) - Math.min(...vals)) / Math.min(...vals)) * 100 : null;
            return <tr key={c.code}><Td><div className="font-semibold">{c.code}</div><div className="text-xs muted">{c.name}</div></Td>
              {data.sources.map((s) => { const r = latest(c.code, s.key); return <Td key={s.key} right>{r ? <><b>{r.rate_to_inr.toFixed(4)}</b><div className={`text-[11px] ${daysOld(r.rate_date) > 3 ? 'text-amber-700 font-bold' : 'muted'}`} title={r.note ?? undefined}>{niceDate(r.rate_date)}{r.note && s.key !== 'manual' ? ' *' : ''}</div></> : <span className="text-gray-300">-</span>}</Td>; })}
              <Td right>{spread === null ? <span className="text-gray-300">-</span> : <span className={spread > 1 ? 'text-amber-700 font-bold' : 'muted'}>{spread.toFixed(2)}%</span>}</Td></tr>;
          })}</tbody></Table>
        <p className="text-xs muted mt-3">* Derived from the ECB dollar rate and the official fixed peg of that currency to the dollar. ECB rates are published once each working day. A difference above 1% between sources is highlighted; check which one your accountant wants before locking an order.</p>
      </Card>

      <Card title="Enter a rate yourself">
        <p className="text-xs muted -mt-1 mb-3">Use this for the rate your accountant or bank gives you (for example the RBI / FBIL reference rate). It then appears as a choice when accepting an order. Rates more than 25% away from the market are refused to catch typing mistakes.</p>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <Label>Currency<Select value={m.currency} onChange={(e) => setM({ ...m, currency: e.target.value })}>{data.currencies.map((c) => <option key={c.code} value={c.code}>{c.code}: {c.name}</option>)}</Select></Label>
          <Label>Rupees for 1 {m.currency}<Input inputMode="decimal" value={m.rate} onChange={(e) => setM({ ...m, rate: e.target.value.replace(/[^0-9.]/g, '') })} placeholder="e.g. 84.50" /></Label>
          <Label>Rate date<Input type="date" max={today()} value={m.date} onChange={(e) => setM({ ...m, date: e.target.value })} /></Label>
          <Label>Where it is from<Input maxLength={200} value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="e.g. RBI reference rate" /></Label></div>
        <div className="mt-4"><Btn busy={busy === 'manual'} disabled={!!busy || !(Number(m.rate) > 0) || !m.date} onClick={addManual}>Save rate</Btn></div>
      </Card>

      <Card title="Prices on the website">
        <p className="text-xs muted -mt-1 mb-4">When switched on, visitors can pick a currency in the menu bar and see an approximate price next to the rupee price. Customers are always charged in rupees, and the website says so. Only fresh rates are shown.</p>
        <fieldset disabled={!canEditSite || busy === 'cfg'} className="space-y-4">
          <label className="flex items-start gap-2.5 text-sm font-semibold"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={cfg.display_enabled} onChange={(e) => setCfg({ ...cfg, display_enabled: e.target.checked })} />Show approximate prices in other currencies</label>
          <div className="grid sm:grid-cols-2 gap-4 max-w-xl">
            <Label help="If this source has no fresh rate for a currency, the next source is used automatically.">Main source for the website
              <Select value={cfg.display_source} onChange={(e) => setCfg({ ...cfg, display_source: e.target.value as FxSourceKey })}>{data.sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></Label>
            <Label help="Rates older than this are hidden.">Hide rates older than (days)
              <Input type="number" min={1} max={30} value={cfg.max_age_days} onChange={(e) => setCfg({ ...cfg, max_age_days: Math.min(30, Math.max(1, Number(e.target.value) || 1)) })} /></Label></div>
          <div><div className="text-xs font-bold mb-2">Currencies visitors can choose</div>
            <div className="flex flex-wrap gap-2">{data.currencies.map((c) => { const on = cfg.currencies.includes(c.code); return <label key={c.code} className={`text-sm rounded-full border px-3 py-1.5 cursor-pointer ${on ? 'bg-[#e3f4e9] border-[#00994d] font-bold' : 'border-gray-300'}`}>
              <input type="checkbox" className="sr-only" checked={on} onChange={() => setCfg({ ...cfg, currencies: on ? cfg.currencies.filter((x) => x !== c.code) : [...cfg.currencies, c.code] })} />{c.code}</label>; })}</div></div>
        </fieldset>
        {canEditSite ? <div className="mt-4"><Btn busy={busy === 'cfg'} disabled={!!busy} onClick={saveCfg}>Save website settings</Btn></div> : <p className="text-xs muted mt-4">Only an owner or admin can change these settings.</p>}
      </Card>
    </div>}
  </div>;
}
