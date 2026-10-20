'use client';
import { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Alert, Badge, Btn, Card, Input, Label, Modal, PageHeader, Select, Spinner, Table, Td, Th, useFlash } from '@/components/admin/ui';
import { api, errMsg } from '@/lib/admin/client';
import { ROLE_LABEL, ROLE_HELP, STAFF_ROLES, type StaffRole } from '@/lib/admin/permissions';
import { fmtDate } from '@/lib/format';

type M = { id: string; email: string; full_name: string | null; role: StaffRole; is_active: boolean; created_at: string };
export default function Page() {
  const [data, setData] = useState<{ members: M[]; me: string; myRole: StaffRole } | null>(null); const [err, setErr] = useState('');
  const [invite, setInvite] = useState(false); const [f, setF] = useState({ email: '', full_name: '', role: 'operations' }); const [busy, setBusy] = useState(false);
  const { show, node } = useFlash();
  const load = useCallback(() => { api<{ members: M[]; me: string; myRole: StaffRole }>('/api/admin/team').then(setData).catch((e) => setErr(errMsg(e))); }, []);
  useEffect(load, [load]);
  async function patch(id: string, body: object) { try { await api('/api/admin/team', { method: 'PATCH', body: { id, ...body } }); show('success', 'Updated.'); load(); } catch (e) { show('error', errMsg(e)); load(); } }
  async function send() { setBusy(true); try { await api('/api/admin/team', { method: 'POST', body: f }); setInvite(false); setF({ email: '', full_name: '', role: 'operations' }); show('success', 'Invitation sent. They will set a password from the email link, then set up two-step verification.'); load(); } catch (e) { show('error', errMsg(e)); } finally { setBusy(false); } }
  if (err) return <Alert tone="error">{err}</Alert>;
  if (!data) return <Spinner />;
  const canOwner = data.myRole === 'owner';
  return <div><PageHeader title="Team & access" subtitle="Who can sign in to the control room, and what each person can see." actions={<Btn onClick={() => setInvite(true)}><UserPlus size={15} />Invite team member</Btn>} />
    {node && <div className="mb-4">{node}</div>}
    <Card><Table><thead><tr><Th>Name</Th><Th>Role</Th><Th>Access</Th><Th>Added</Th></tr></thead><tbody>
      {data.members.map((m) => { const self = m.id === data.me; const locked = self || (m.role === 'owner' && !canOwner);
        return <tr key={m.id}><Td><div className="font-bold">{m.full_name || '—'} {self && <Badge tone="blue">You</Badge>}</div><div className="text-xs muted">{m.email}</div></Td>
          <Td><Select aria-label="Role" value={m.role} disabled={locked} className="!mt-0 !w-auto !py-2 text-sm" onChange={(e) => patch(m.id, { role: e.target.value })}>{STAFF_ROLES.filter((r) => r !== 'owner' || canOwner || m.role === 'owner').map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Td>
          <Td>{m.is_active ? <Badge tone="green">Active</Badge> : <Badge tone="red">Switched off</Badge>} {!locked && <button onClick={() => patch(m.id, { is_active: !m.is_active })} className="ml-2 text-xs underline">{m.is_active ? 'Switch off' : 'Switch on'}</button>}</Td>
          <Td>{fmtDate(m.created_at)}</Td></tr>; })}
    </tbody></Table></Card>
    <Card title="What each role can do" className="mt-4"><ul className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">{STAFF_ROLES.map((r) => <li key={r}><b>{ROLE_LABEL[r]}:</b> <span className="muted">{ROLE_HELP[r]}</span></li>)}</ul></Card>
    {invite && <Modal title="Invite team member" onClose={() => setInvite(false)} footer={<><Btn variant="outline" onClick={() => setInvite(false)}>Cancel</Btn><Btn busy={busy} onClick={send} disabled={!f.email}>Send invitation</Btn></>}>
      <div className="space-y-4"><Label>Full name<Input value={f.full_name} maxLength={120} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Label>
        <Label>Email<Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Label>
        <Label help={ROLE_HELP[f.role as StaffRole]}>Role<Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{STAFF_ROLES.filter((r) => r !== 'owner' || canOwner).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</Select></Label></div></Modal>}
  </div>;
}
