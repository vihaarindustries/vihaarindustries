'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Alert, Badge, Btn, Card, Empty, Input, Label, Modal, PageHeader, PeriodSelect, Select, Spinner, Stat, Table, Tabs, Td, Textarea, Th, useFlash } from '../ui';
import ResourceManager from '../ResourceManager';
import { LineChart } from '../charts';
import { PayModal } from './Purchases';
import { api, rpc, errMsg } from '@/lib/admin/client';
import { fmtDate, fmtMoney } from '@/lib/format';

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Indian financial year runs 1 April to 31 March. */
export function periodRange(p: string) {
  const now = new Date(); const y = now.getFullYear(); const fyStart = now.getMonth() >= 3 ? y : y - 1;
  switch (p) {
    case 'month': return { from: ymd(new Date(y, now.getMonth(), 1)), to: ymd(now) };
    case 'lastmonth': return { from: ymd(new Date(y, now.getMonth() - 1, 1)), to: ymd(new Date(y, now.getMonth(), 0)) };
    case 'lastfy': return { from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` };
    case '90': return { from: ymd(new Date(now.getTime() - 90 * 86400000)), to: ymd(now) };
    default: return { from: `${fyStart}-04-01`, to: ymd(now) };
  }
}
const PERIODS = [{ value: 'month', label: 'This month' }, { value: 'lastmonth', label: 'Last month' }, { value: '90', label: 'Last 90 days' }, { value: 'fy', label: 'This financial year' }, { value: 'lastfy', label: 'Last financial year' }];

/* ───────── Overview ───────── */
type Sum = { revenue_minor: number; cogs_minor: number; gross_profit_minor: number; expenses_minor: number; net_profit_minor: number; cash_minor: number; receivables_minor: number; payables_minor: number; inventory_minor: number; gst_payable_minor: number; months: { month: string; revenue: number; expenses: number }[] };
export function FinanceOverview() {
  const [p, setP] = useState('fy'); const [s, setS] = useState<Sum | null>(null); const [err, setErr] = useState('');
  useEffect(() => { setS(null); const r = periodRange(p); rpc<Sum>('finance_summary', { p_from: r.from, p_to: r.to }).then(setS).catch((e) => setErr(errMsg(e))); }, [p]);
  const m = (n: number) => fmtMoney(n, 'INR', { compact: true });
  return <div><PageHeader title="Finance overview" subtitle="Profit, cash and what is owed, built from your orders, purchases and recorded transactions." actions={<PeriodSelect value={p} onChange={setP} options={PERIODS} />} />
    {err && <Alert tone="error">{err}</Alert>}{!s && !err && <Spinner />}
    {s && <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue" value={m(s.revenue_minor)} /><Stat label="Gross profit" value={m(s.gross_profit_minor)} hint={s.revenue_minor ? `${Math.round((s.gross_profit_minor / s.revenue_minor) * 100)}% margin` : undefined} />
        <Stat label="Expenses" value={m(s.expenses_minor)} /><Stat label="Net profit" value={m(s.net_profit_minor)} tone={s.net_profit_minor < 0 ? 'bad' : 'good'} />
        <Stat label="Cash & bank" value={m(s.cash_minor)} hint="as of today" /><Stat label="Customers owe you" value={m(s.receivables_minor)} hint={<Link href="/control-room/finance/receivables" className="underline">View</Link>} />
        <Stat label="You owe suppliers" value={m(s.payables_minor)} hint={<Link href="/control-room/finance/payables" className="underline">View</Link>} /><Stat label="Stock value" value={m(s.inventory_minor)} />
        <Stat label="GST payable (net of credit)" value={m(s.gst_payable_minor)} hint="output GST collected, as booked" />
      </div>
      <Card title="Revenue and expenses by month"><LineChart data={s.months.map((x) => ({ label: x.month, value: x.revenue / 100, value2: x.expenses / 100 }))} format={(n) => fmtMoney(n * 100, 'INR', { compact: true })} label="Revenue" label2="Expenses" /></Card>
      <Alert tone="info">These figures are management numbers for running the business. Have your accountant review the GST, TDS and year-end treatment before filing returns.</Alert>
    </div>}</div>;
}

/* ───────── Transactions ───────── */
type Acct = { id: string; code: string; name: string; account_type: string };
type JLine = { account: string; side: 'debit' | 'credit'; amount: string; memo: string };
export function Transactions() {
  const [open, setOpen] = useState(false); const [key, setKey] = useState(0); const { show, node } = useFlash();
  const [rev, setRev] = useState<{ id: string; n: number } | null>(null);
  return <div><PageHeader title="Record transaction" subtitle="Add money in or out that did not come from an order or purchase, such as rent, salaries, bank charges or owner investment. Entries cannot be edited; to fix one, reverse it." actions={<Btn onClick={() => setOpen(true)}><Plus size={15} />New transaction</Btn>} />
    {node && <div className="mb-4">{node}</div>}
    <ResourceManager resource="journal_entries" refreshKey={key} rowActions={(r) => r.status === 'posted' && r.source_type === 'manual' ? <Btn size="sm" variant="outline" onClick={() => setRev({ id: r.id, n: Number(r.entry_number) })}>Reverse</Btn> : null} />
    {open && <NewTxn onClose={() => setOpen(false)} onDone={() => { setOpen(false); show('success', 'Transaction recorded.'); setKey((k) => k + 1); }} />}
    {rev && <Reverse entry={rev} onClose={() => setRev(null)} onDone={() => { setRev(null); show('success', 'Entry reversed.'); setKey((k) => k + 1); }} />}</div>;
}
function Reverse({ entry, onClose, onDone }: { entry: { id: string; n: number }; onClose: () => void; onDone: () => void }) {
  const [why, setWhy] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return <Modal title={`Reverse entry #${entry.n}`} onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn variant="danger" busy={busy} disabled={why.trim().length < 3} onClick={async () => { setBusy(true); try { await rpc('reverse_journal', { p_id: entry.id, p_reason: why }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); } }}>Reverse entry</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}<p className="text-sm">A matching opposite entry is added, so the history stays intact.</p><Label>Reason<Textarea rows={2} maxLength={300} value={why} onChange={(e) => setWhy(e.target.value)} /></Label></div></Modal>;
}
function NewTxn({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [accts, setAccts] = useState<Acct[]>([]); useEffect(() => { api<Acct[]>('/api/admin/r/chart_of_accounts?size=100').then(setAccts).catch(() => {}); }, []);
  const [kind, setKind] = useState('expense'); const [date, setDate] = useState(ymd(new Date())); const [desc, setDesc] = useState(''); const [amount, setAmount] = useState(''); const [gst, setGst] = useState('');
  const [acct, setAcct] = useState(''); const [lines, setLines] = useState<JLine[]>([{ account: '', side: 'debit', amount: '', memo: '' }, { account: '', side: 'credit', amount: '', memo: '' }]);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const by = (t: string) => accts.filter((a) => a.account_type === t);
  const minor = (s: string) => Math.round(Number(s || '0') * 100);
  const dr = lines.filter((l) => l.side === 'debit').reduce((s, l) => s + minor(l.amount), 0); const cr = lines.filter((l) => l.side === 'credit').reduce((s, l) => s + minor(l.amount), 0);

  function build() {
    const amt = minor(amount); const g = minor(gst);
    if (kind === 'expense') return [{ account: acct, debit: amt }, ...(g ? [{ account: '1300', debit: g }] : []), { account: '1000', credit: amt + g }];
    if (kind === 'income') return [{ account: '1000', debit: amt }, { account: acct, credit: amt }];
    if (kind === 'capital') return [{ account: '1000', debit: amt }, { account: '3000', credit: amt }];
    if (kind === 'drawings') return [{ account: '3200', debit: amt }, { account: '1000', credit: amt }];
    return lines.map((l) => ({ account: l.account, ...(l.side === 'debit' ? { debit: minor(l.amount) } : { credit: minor(l.amount) }), ...(l.memo ? { memo: l.memo } : {}) }));
  }
  async function go() {
    setBusy(true); setErr('');
    try { await rpc('post_manual_journal', { p_date: date, p_description: desc, p_lines: build() }); onDone(); } catch (e) { setErr(errMsg(e)); setBusy(false); }
  }
  const needAcct = kind === 'expense' || kind === 'income';
  const ready = desc.trim().length >= 3 && (kind === 'advanced' ? dr > 0 && dr === cr && lines.every((l) => l.account) : minor(amount) > 0 && (!needAcct || !!acct));
  return <Modal wide title="New transaction" onClose={onClose} footer={<><Btn variant="outline" onClick={onClose}>Cancel</Btn><Btn busy={busy} disabled={!ready} onClick={go}>Save transaction</Btn></>}>
    <div className="space-y-4">{err && <Alert tone="error">{err}</Alert>}
      <div className="grid sm:grid-cols-2 gap-4"><Label>Type<Select value={kind} onChange={(e) => { setKind(e.target.value); setAcct(''); }}><option value="expense">Money out: expense paid</option><option value="income">Money in: other income received</option><option value="capital">Money in: owner investment</option><option value="drawings">Money out: owner withdrawal</option><option value="advanced">Advanced journal entry (accountant)</option></Select></Label>
        <Label>Date<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Label></div>
      <Label>Description<Input maxLength={300} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={kind === 'expense' ? 'e.g. Warehouse rent for October' : 'What is this for?'} /></Label>
      {kind !== 'advanced' && <div className="grid sm:grid-cols-2 gap-4">
        {needAcct && <Label help={kind === 'expense' ? 'What the money was spent on' : 'Where the income belongs'}>{kind === 'expense' ? 'Expense category' : 'Income category'}<Select value={acct} onChange={(e) => setAcct(e.target.value)}><option value="">Choose…</option>{(kind === 'expense' ? by('expense').filter((a) => a.code !== '5000') : by('revenue')).map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}</Select></Label>}
        <Label help={kind === 'expense' ? 'Amount before GST' : undefined}>Amount (₹)<Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} /></Label>
        {kind === 'expense' && <Label help="Optional: input GST you can claim">GST on the bill (₹)<Input inputMode="decimal" value={gst} onChange={(e) => setGst(e.target.value.replace(/[^0-9.]/g, ''))} /></Label>}
        <p className="text-xs muted self-end">{kind === 'expense' ? 'Paid from Cash & Bank.' : kind === 'drawings' ? 'Taken from Cash & Bank.' : 'Received into Cash & Bank.'}</p></div>}
      {kind === 'advanced' && <div className="space-y-2">{lines.map((l, i) => <div key={i} className="grid grid-cols-[1fr_100px_110px_auto] gap-2">
        <Select aria-label="Account" value={l.account} className="!mt-0" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, account: e.target.value } : x)))}><option value="">Account…</option>{accts.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</Select>
        <Select aria-label="Debit or credit" value={l.side} className="!mt-0" onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, side: e.target.value as JLine['side'] } : x)))}><option value="debit">Debit</option><option value="credit">Credit</option></Select>
        <Input aria-label="Amount" inputMode="decimal" placeholder="₹" className="!mt-0" value={l.amount} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value.replace(/[^0-9.]/g, '') } : x)))} />
        <button aria-label="Remove line" className="p-2 text-gray-400 hover:text-red-600" onClick={() => lines.length > 2 && setLines(lines.filter((_, j) => j !== i))}><Trash2 size={16} /></button></div>)}
        <Btn variant="outline" size="sm" onClick={() => lines.length < 20 && setLines([...lines, { account: '', side: 'debit', amount: '', memo: '' }])}><Plus size={14} />Add line</Btn>
        <p className={`text-xs ${dr === cr && dr > 0 ? 'text-[#008b47]' : 'text-red-600'}`}>Debits {fmtMoney(dr)} · Credits {fmtMoney(cr)} {dr === cr && dr > 0 ? '· balanced' : '· must be equal'}</p></div>}
    </div></Modal>;
}

/* ───────── Statements ───────── */
type Bal = { code: string; name: string; account_type: string; debit_minor: number; credit_minor: number };
export function Statements() {
  const [tab, setTab] = useState('pl'); const [p, setP] = useState('fy'); const [period, setPeriod] = useState<Bal[] | null>(null); const [asOf, setAsOf] = useState<Bal[] | null>(null); const [err, setErr] = useState('');
  const r = useMemo(() => periodRange(p), [p]);
  const load = useCallback(async () => { setErr(''); setPeriod(null); setAsOf(null); try { const [a, b] = await Promise.all([rpc<Bal[]>('account_balances', { p_from: r.from, p_to: r.to }), rpc<Bal[]>('account_balances', { p_to: r.to })]); setPeriod(a); setAsOf(b); } catch (e) { setErr(errMsg(e)); } }, [r]);
  useEffect(() => { load(); }, [load]);
  const net = (b: Bal, side: 'dr' | 'cr') => (side === 'dr' ? b.debit_minor - b.credit_minor : b.credit_minor - b.debit_minor);
  const Row = ({ label, value, bold }: { label: string; value: number; bold?: boolean }) => <tr><Td className={bold ? 'font-black' : ''}>{label}</Td><Td right className={bold ? 'font-black' : ''}>{fmtMoney(value)}</Td></tr>;
  return <div><PageHeader title="Financial statements" subtitle={`${fmtDate(r.from)} to ${fmtDate(r.to)}`} actions={<PeriodSelect value={p} onChange={setP} options={PERIODS} />} />
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'pl', label: 'Profit & loss' }, { key: 'bs', label: 'Balance sheet' }, { key: 'tb', label: 'Trial balance' }]} />
    {err && <Alert tone="error">{err}</Alert>}{!period && !err && <Spinner />}
    {period && asOf && tab === 'pl' && (() => { const rev = period.filter((b) => b.account_type === 'revenue'); const exp = period.filter((b) => b.account_type === 'expense'); const cogs = exp.filter((b) => b.code === '5000'); const opx = exp.filter((b) => b.code !== '5000');
      const tr = rev.reduce((s, b) => s + net(b, 'cr'), 0); const tc = cogs.reduce((s, b) => s + net(b, 'dr'), 0); const to = opx.reduce((s, b) => s + net(b, 'dr'), 0);
      return <Card><Table><tbody><tr><Td className="font-black text-xs uppercase tracking-wider text-gray-500" >Revenue</Td><Td /></tr>{rev.filter((b) => net(b, 'cr') !== 0).map((b) => <Row key={b.code} label={b.name} value={net(b, 'cr')} />)}<Row label="Total revenue" value={tr} bold />
        <tr><Td className="font-black text-xs uppercase tracking-wider text-gray-500 pt-6">Cost of goods sold</Td><Td /></tr><Row label="Cost of goods sold" value={tc} /><Row label="Gross profit" value={tr - tc} bold />
        <tr><Td className="font-black text-xs uppercase tracking-wider text-gray-500 pt-6">Operating expenses</Td><Td /></tr>{opx.filter((b) => net(b, 'dr') !== 0).map((b) => <Row key={b.code} label={b.name} value={net(b, 'dr')} />)}<Row label="Total operating expenses" value={to} bold />
        <Row label="Net profit" value={tr - tc - to} bold /></tbody></Table></Card>; })()}
    {period && asOf && tab === 'bs' && (() => { const A = asOf.filter((b) => b.account_type === 'asset'); const L = asOf.filter((b) => b.account_type === 'liability'); const E = asOf.filter((b) => b.account_type === 'equity');
      const profit = asOf.filter((b) => b.account_type === 'revenue').reduce((s, b) => s + net(b, 'cr'), 0) - asOf.filter((b) => b.account_type === 'expense').reduce((s, b) => s + net(b, 'dr'), 0);
      const ta = A.reduce((s, b) => s + net(b, 'dr'), 0); const tl = L.reduce((s, b) => s + net(b, 'cr'), 0); const te = E.reduce((s, b) => s + net(b, 'cr'), 0) + profit;
      return <div className="grid md:grid-cols-2 gap-4"><Card title={`Assets as of ${fmtDate(r.to)}`}><Table><tbody>{A.map((b) => <Row key={b.code} label={b.name} value={net(b, 'dr')} />)}<Row label="Total assets" value={ta} bold /></tbody></Table></Card>
        <Card title="Liabilities and equity"><Table><tbody>{L.map((b) => <Row key={b.code} label={b.name} value={net(b, 'cr')} />)}<Row label="Total liabilities" value={tl} bold />{E.map((b) => <Row key={b.code} label={b.name} value={net(b, 'cr')} />)}<Row label="Profit to date (not yet closed)" value={profit} /><Row label="Total equity" value={te} bold /><Row label="Liabilities + equity" value={tl + te} bold /></tbody></Table>
          {ta !== tl + te && <div className="mt-3"><Alert tone="error">The balance sheet does not balance. Please contact your accountant.</Alert></div>}</Card></div>; })()}
    {period && asOf && tab === 'tb' && <Card><Table><thead><tr><Th>Code</Th><Th>Account</Th><Th right>Debit</Th><Th right>Credit</Th></tr></thead><tbody>{asOf.filter((b) => b.debit_minor || b.credit_minor).map((b) => <tr key={b.code}><Td>{b.code}</Td><Td>{b.name}</Td><Td right>{fmtMoney(b.debit_minor)}</Td><Td right>{fmtMoney(b.credit_minor)}</Td></tr>)}
      <tr><Td /><Td className="font-black">Total</Td><Td right className="font-black">{fmtMoney(asOf.reduce((s, b) => s + b.debit_minor, 0))}</Td><Td right className="font-black">{fmtMoney(asOf.reduce((s, b) => s + b.credit_minor, 0))}</Td></tr></tbody></Table></Card>}
  </div>;
}

/* ───────── Receivables & payables ───────── */
const bucket = (d: number) => (d <= 30 ? '0–30 days' : d <= 60 ? '31–60 days' : d <= 90 ? '61–90 days' : 'Over 90 days');
const BUCKETS = ['0–30 days', '31–60 days', '61–90 days', 'Over 90 days'];
type AR = { order_id: string; order_number: string; customer_name: string; total_minor: number; paid_minor: number; outstanding_minor: number; invoiced_on: string; age_days: number };
type AP = { po_id: string; po_number: string; supplier_name: string; total_minor: number; paid_minor: number; outstanding_minor: number; received_on: string; age_days: number };

export function Receivables() {
  const [rows, setRows] = useState<AR[] | null>(null); const [err, setErr] = useState('');
  useEffect(() => { rpc<AR[]>('receivables').then(setRows).catch((e) => setErr(errMsg(e))); }, []);
  const tot = rows?.reduce((s, r) => s + r.outstanding_minor, 0) ?? 0;
  return <div><PageHeader title="Receivables" subtitle="Money customers still owe you on shipped orders, oldest first." />
    {err && <Alert tone="error">{err}</Alert>}{!rows && !err && <Spinner />}
    {rows && <><div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4"><Stat label="Total owed" value={fmtMoney(tot, 'INR', { compact: true })} />{BUCKETS.map((b) => <Stat key={b} label={b} value={fmtMoney(rows.filter((r) => bucket(r.age_days) === b).reduce((s, r) => s + r.outstanding_minor, 0), 'INR', { compact: true })} />)}</div>
      <Card>{!rows.length ? <Empty>Nothing outstanding. 🎉</Empty> : <Table><thead><tr><Th>Order</Th><Th>Customer</Th><Th>Invoiced</Th><Th>Age</Th><Th right>Total</Th><Th right>Paid</Th><Th right>Owed</Th></tr></thead><tbody>
        {rows.map((r) => <tr key={r.order_id}><Td><Link className="font-bold underline" href={`/control-room/orders/${r.order_id}`}>{r.order_number}</Link></Td><Td>{r.customer_name}</Td><Td>{fmtDate(r.invoiced_on)}</Td><Td><Badge tone={r.age_days > 60 ? 'red' : r.age_days > 30 ? 'amber' : 'gray'}>{r.age_days} days</Badge></Td><Td right>{fmtMoney(r.total_minor)}</Td><Td right>{fmtMoney(r.paid_minor)}</Td><Td right className="font-bold">{fmtMoney(r.outstanding_minor)}</Td></tr>)}</tbody></Table>}</Card>
      <p className="text-xs muted mt-3">To record a payment, open the order.</p></>}</div>;
}

export function Payables() {
  const [rows, setRows] = useState<AP[] | null>(null); const [err, setErr] = useState(''); const [pay, setPay] = useState<{ id: string; num: string; due: number } | null>(null); const { show, node } = useFlash();
  const load = useCallback(() => { rpc<AP[]>('payables').then(setRows).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(load, [load]);
  const tot = rows?.reduce((s, r) => s + r.outstanding_minor, 0) ?? 0;
  return <div><PageHeader title="Payables" subtitle="Money you still owe suppliers for goods received." />
    {err && <Alert tone="error">{err}</Alert>}{node && <div className="mb-4">{node}</div>}{!rows && !err && <Spinner />}
    {rows && <><div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4"><Stat label="Total owed" value={fmtMoney(tot, 'INR', { compact: true })} />{BUCKETS.map((b) => <Stat key={b} label={b} value={fmtMoney(rows.filter((r) => bucket(r.age_days) === b).reduce((s, r) => s + r.outstanding_minor, 0), 'INR', { compact: true })} />)}</div>
      <Card>{!rows.length ? <Empty>You do not owe any suppliers.</Empty> : <Table><thead><tr><Th>Purchase</Th><Th>Supplier</Th><Th>Received</Th><Th>Age</Th><Th right>Total</Th><Th right>Paid</Th><Th right>Owed</Th><Th /></tr></thead><tbody>
        {rows.map((r) => <tr key={r.po_id}><Td className="font-bold">{r.po_number}</Td><Td>{r.supplier_name}</Td><Td>{fmtDate(r.received_on)}</Td><Td><Badge tone={r.age_days > 60 ? 'red' : r.age_days > 30 ? 'amber' : 'gray'}>{r.age_days} days</Badge></Td><Td right>{fmtMoney(r.total_minor)}</Td><Td right>{fmtMoney(r.paid_minor)}</Td><Td right className="font-bold">{fmtMoney(r.outstanding_minor)}</Td><Td right><Btn size="sm" variant="outline" onClick={() => setPay({ id: r.po_id, num: r.po_number, due: r.outstanding_minor })}>Pay</Btn></Td></tr>)}</tbody></Table>}</Card></>}
    {pay && <PayModal po={pay} onClose={() => setPay(null)} onDone={() => { setPay(null); show('success', 'Payment recorded.'); load(); }} />}</div>;
}
