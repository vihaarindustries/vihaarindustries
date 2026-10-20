'use client';
import { useState } from 'react';
import { Alert, Btn, Card, Confirm, Input, Label, PageHeader, Select, Spinner, Tabs, useFlash } from '@/components/admin/ui';
import ResourceManager from '@/components/admin/ResourceManager';
import { useSetting } from '@/components/admin/useSetting';
import { useRole } from '@/components/admin/role';
import { errMsg, rpc } from '@/lib/admin/client';

type Prog = { enabled: boolean; referrer_reward_minor: number; referee_discount_type: 'percentage' | 'fixed'; referee_discount_value: number; min_order_minor: number };

export default function Page() {
  const role = useRole(); const isAdmin = ['owner', 'admin'].includes(role); const canFin = ['owner', 'admin', 'finance'].includes(role);
  const [tab, setTab] = useState('list'); const [key, setKey] = useState(0); const { show, node } = useFlash();
  const act = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); show('success', ok); setKey((k) => k + 1); } catch (e) { show('error', errMsg(e)); } };
  return <div><PageHeader title="Referrals" subtitle="Customers share their personal code. A new customer gets a discount on their first order, and the referrer earns a reward once that order is delivered." />
    {node && <div className="mb-4">{node}</div>}
    <Tabs value={tab} onChange={setTab} tabs={[{ key: 'list', label: 'Referrals' }, { key: 'rules', label: 'Programme rules' }]} />
    {tab === 'rules' ? <Rules editable={isAdmin} /> : <ResourceManager resource="referrals" refreshKey={key} rowActions={(r) => canFin ? <>
      {r.status === 'qualified' && <Confirm variant="primary" label="Mark rewarded" message="Record the reward as paid? This books the reward as a marketing expense in Finance." onConfirm={() => act(() => rpc('mark_referral_rewarded', { p_referral: r.id }), 'Reward recorded.')} />}
      {(r.status === 'pending' || r.status === 'qualified') && <Confirm label="Reject" message="Reject this referral? No reward will be paid." onConfirm={() => act(() => rpc('reject_referral', { p_referral: r.id }), 'Referral rejected.')} />}</> : null} />}
  </div>;
}

function Rules({ editable }: { editable: boolean }) {
  const { value, setValue, loading, error, save } = useSetting<Prog>('referral_program', { enabled: false, referrer_reward_minor: 0, referee_discount_type: 'fixed', referee_discount_value: 0, min_order_minor: 0 });
  const [busy, setBusy] = useState(false); const { show, node } = useFlash();
  if (loading) return <Spinner />;
  const pct = value.referee_discount_type === 'percentage';
  const toRs = (n: number) => String(n / 100); const toMinor = (s: string) => Math.round(Number(s || '0') * 100);
  return <Card title="Programme rules">
    {error && <Alert tone="error">{error}</Alert>}{node}
    {!editable && <div className="mb-4"><Alert tone="info">Only owners and admins can change these rules.</Alert></div>}
    <fieldset disabled={!editable} className="space-y-5 max-w-xl">
      <label className="flex items-start gap-2.5 text-sm font-semibold"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={value.enabled} onChange={(e) => setValue({ ...value, enabled: e.target.checked })} /><span>Referral programme is on<span className="block text-xs font-normal muted">When off, referral codes are refused on new orders.</span></span></label>
      <div className="grid sm:grid-cols-2 gap-4">
        <Label help="What the new customer gets on their first order">Discount type<Select value={value.referee_discount_type} onChange={(e) => setValue({ ...value, referee_discount_type: e.target.value as Prog['referee_discount_type'], referee_discount_value: 0 })}><option value="fixed">Fixed amount (₹)</option><option value="percentage">Percentage (%)</option></Select></Label>
        <Label>Discount {pct ? '(%)' : '(₹)'}<Input inputMode="decimal" value={pct ? String(value.referee_discount_value) : toRs(value.referee_discount_value)} onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); setValue({ ...value, referee_discount_value: pct ? Number(v || 0) : toMinor(v) }); }} /></Label>
        <Label help="Smallest first order that earns the discount">Minimum first order (₹)<Input inputMode="decimal" value={toRs(value.min_order_minor)} onChange={(e) => setValue({ ...value, min_order_minor: toMinor(e.target.value.replace(/[^0-9.]/g, '')) })} /></Label>
        <Label help="Paid to the referrer after the new customer's first order is delivered">Referrer reward (₹)<Input inputMode="decimal" value={toRs(value.referrer_reward_minor)} onChange={(e) => setValue({ ...value, referrer_reward_minor: toMinor(e.target.value.replace(/[^0-9.]/g, '')) })} /></Label>
      </div>
      {editable && <Btn busy={busy} onClick={async () => { setBusy(true); try { await save(value); show('success', 'Rules saved.'); } catch (e) { show('error', errMsg(e)); } finally { setBusy(false); } }}>Save rules</Btn>}
    </fieldset>
    <ul className="text-xs muted mt-6 list-disc pl-5 space-y-1"><li>A code works only on a customer&apos;s first order and cannot be their own.</li><li>A referral code and a coupon cannot be combined on the same order.</li><li>Each customer has one permanent code, shown on their record.</li></ul>
  </Card>;
}
