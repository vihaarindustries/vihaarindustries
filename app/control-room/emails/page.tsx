'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Btn, Card, Confirm, Empty, Label, PageHeader, Spinner, Table, Td, Th, useFlash, cx } from '@/components/admin/ui';
import { api, errMsg } from '@/lib/admin/client';
import { EMAIL_EVENTS, allVarsFor, getEvent, sampleVars, type EmailEvent, type EmailGroup } from '@/lib/email/events';
import { renderEmail } from '@/lib/email/render';

type Override = { event_key: string; subject: string; body: string; button_label: string | null; enabled: boolean; updated_at: string };
type LogRow = { id: string; event_key: string; to_email: string; subject: string | null; status: 'sent' | 'failed' | 'skipped'; error: string | null; order_number: string | null; created_at: string };
type Data = { overrides: Override[]; log: LogRow[]; configured: boolean; hookConfigured: boolean };
type Draft = { subject: string; body: string; button_label: string; enabled: boolean };
const GROUPS: EmailGroup[] = ['Account', 'Orders', 'Payments'];
const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function Page() {
  const [data, setData] = useState<Data | null>(null); const [err, setErr] = useState('');
  const [sel, setSel] = useState<string>(EMAIL_EVENTS[0].key);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'' | 'save' | 'test'>('');
  const { show, node } = useFlash();
  const subjRef = useRef<HTMLInputElement>(null); const bodyRef = useRef<HTMLTextAreaElement>(null); const last = useRef<'subject' | 'body'>('body');

  const load = useCallback(async () => { try { setData(await api<Data>('/api/admin/email-templates')); } catch (e) { setErr(errMsg(e)); } }, []);
  useEffect(() => { load(); }, [load]);

  const ev = getEvent(sel) as EmailEvent;
  const override = data?.overrides.find((o) => o.event_key === sel);
  const current = useCallback((e: EmailEvent): Draft => {
    const o = data?.overrides.find((x) => x.event_key === e.key);
    return o ? { subject: o.subject, body: o.body, button_label: o.button_label ?? '', enabled: o.enabled } : { subject: e.defaults.subject, body: e.defaults.body, button_label: e.defaults.buttonLabel, enabled: true };
  }, [data]);
  // Load the draft when the person picks another email, or when the data first arrives. Deliberately NOT on every refresh,
  // so sending a test (which refreshes the "recently sent" list) never wipes unsaved edits.
  const loaded = !!data;
  useEffect(() => { if (loaded) setDraft(current(ev)); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel, loaded]);

  const dirty = useMemo(() => { if (!draft) return false; const c = current(ev); return c.subject !== draft.subject || c.body !== draft.body || c.button_label !== draft.button_label || c.enabled !== draft.enabled; }, [draft, ev, current]);
  const preview = useMemo(() => {
    if (!draft) return null;
    const v = sampleVars(ev);
    return renderEmail({ subject: draft.subject, body: draft.body, buttonLabel: draft.button_label, buttonUrl: ev.buttonVar ? v[ev.buttonVar] : undefined, vars: v, brandName: v.site_name, footerLines: [v.support_email, v.support_phone] });
  }, [draft, ev]);

  function pick(key: string) {
    if (dirty && !window.confirm('You have unsaved changes to this email. Switch anyway and lose them?')) return;
    setSel(key);
  }
  function insert(token: string) {
    const el = last.current === 'subject' ? subjRef.current : bodyRef.current;
    if (!el || !draft) return;
    const s = el.selectionStart ?? el.value.length; const e = el.selectionEnd ?? s;
    const next = el.value.slice(0, s) + token + el.value.slice(e);
    setDraft({ ...draft, [last.current]: next });
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); });
  }
  const payload = () => ({ subject: draft!.subject, body: draft!.body, button_label: draft!.button_label.trim() || null, enabled: draft!.enabled });

  async function save() {
    setBusy('save');
    try { await api(`/api/admin/email-templates/${sel}`, { method: 'PUT', body: payload() }); await load(); show('success', `“${ev.label}” saved. New emails use it straight away.`); }
    catch (e) { show('error', errMsg(e)); } finally { setBusy(''); }
  }
  async function test() {
    setBusy('test');
    try { const r = await api<{ sent_to: string }>(`/api/admin/email-templates/${sel}/test`, { method: 'POST', body: payload() }); show('success', `Test email sent to ${r.sent_to} (with sample details). Check your inbox and spam folder.`); await load(); }
    catch (e) { show('error', errMsg(e)); } finally { setBusy(''); }
  }
  async function reset() {
    try { await api(`/api/admin/email-templates/${sel}`, { method: 'DELETE' }); await load(); setDraft({ subject: ev.defaults.subject, body: ev.defaults.body, button_label: ev.defaults.buttonLabel, enabled: true }); show('success', 'Back to the original wording.'); }
    catch (e) { show('error', errMsg(e)); }
  }

  if (!data && !err) return <Spinner />;
  return <div>
    <PageHeader title="Email templates" subtitle="The emails your customers receive. Each one is sent automatically when the event on the left happens. Edit the wording, preview it, and send yourself a test." />
    {err && <div className="mb-4"><Alert tone="error">{err}</Alert></div>}
    {node && <div className="mb-4">{node}</div>}
    {data && !data.configured && <div className="mb-4"><Alert tone="warn"><b>Email is not connected yet.</b> Emails are not being sent. Your developer needs to add <code>EMAIL_PROVIDER_API_KEY</code> and <code>EMAIL_FROM</code> (your Brevo details) on the server. See Integrations.</Alert></div>}
    {data && data.configured && !data.hookConfigured && <div className="mb-4"><Alert tone="info"><b>Verification email:</b> until the Supabase “Send Email” hook is connected (<code>SEND_EMAIL_HOOK_SECRET</code>), sign-up verification emails still come from Supabase and do not use the template below.</Alert></div>}

    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
      <div className="space-y-4">
        {GROUPS.map((g) => <Card key={g} title={g}>
          <ul className="-my-2 divide-y divide-gray-100">{EMAIL_EVENTS.filter((e) => e.group === g).map((e) => {
            const o = data?.overrides.find((x) => x.event_key === e.key);
            return <li key={e.key}><button type="button" onClick={() => pick(e.key)} className={cx('w-full text-left py-3 px-2 -mx-2 rounded-md hover:bg-gray-50', sel === e.key && 'bg-[#e3f4e9]')}>
              <span className="flex items-center justify-between gap-2"><span className="font-bold text-sm">{e.label}</span>
                {o && !o.enabled && !e.locked ? <Badge tone="red">Off</Badge> : o ? <Badge tone="blue">Edited</Badge> : <Badge>Default</Badge>}</span>
              <span className="block text-xs muted mt-0.5">{e.trigger}</span></button></li>;
          })}</ul></Card>)}
      </div>

      {draft && preview && <div className="space-y-4 min-w-0">
        <Card title={ev.label} action={<div className="flex items-center gap-2">{override && <Confirm label="Reset to default" message="Replace your wording for this email with the original wording? Your edits will be lost." onConfirm={reset} variant="outline" />}</div>}>
          <p className="text-xs muted -mt-1 mb-4">Sent: {ev.trigger}</p>
          {ev.locked
            ? <p className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 mb-4">This is an account-security email, so it is always sent and cannot be switched off. You can change its wording.</p>
            : <label className="flex items-start gap-2.5 text-sm font-semibold mb-4"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /><span>Send this email<span className="block text-xs font-normal muted">Untick to stop sending it. Customers still see the update on the Track order page.</span></span></label>}
          <div className="space-y-4">
            <Label>Subject
              <input ref={subjRef} className="field block mt-1.5" maxLength={200} value={draft.subject} onFocus={() => (last.current = 'subject')} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} /></Label>
            <Label help="Leave a blank line between paragraphs. Start a line with “- ” for bullets. Use **bold** for bold text. A line is skipped automatically when the detail on it is empty (for example, no tracking link).">Message
              <textarea ref={bodyRef} className="field block mt-1.5 font-mono text-[13px]" rows={14} maxLength={5000} value={draft.body} onFocus={() => (last.current = 'body')} onChange={(e) => setDraft({ ...draft, body: e.target.value })} /></Label>
            <div>
              <div className="text-xs font-bold mb-1.5">Click to insert a detail at the cursor</div>
              <div className="flex flex-wrap gap-1.5">{allVarsFor(ev).map((v) => <button type="button" key={v.key} title={`${v.label}: e.g. ${v.sample.split('\n')[0]}`} onClick={() => insert(`{{${v.key}}}`)} className="text-xs rounded-full border border-gray-300 bg-white hover:bg-gray-50 px-2.5 py-1"><span className="font-semibold">{v.label}</span> <code className="text-[10px] text-gray-500">{`{{${v.key}}}`}</code></button>)}</div>
            </div>
            <Label help={ev.buttonVar ? `The button opens: ${allVarsFor(ev).find((v) => v.key === ev.buttonVar)?.label ?? ev.buttonVar}. Leave empty for no button.` : undefined}>Button text
              <input className="field block mt-1.5 max-w-xs" maxLength={40} value={draft.button_label} onChange={(e) => setDraft({ ...draft, button_label: e.target.value })} /></Label>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <Btn busy={busy === 'save'} disabled={!dirty || !!busy} onClick={save}>Save changes</Btn>
            <Btn variant="outline" busy={busy === 'test'} disabled={!!busy || !data?.configured} onClick={test}>Send test to me</Btn>
            {dirty && <span className="text-xs text-amber-700 font-semibold">Unsaved changes</span>}
          </div>
        </Card>

        <Card title="Preview (with sample details)">
          <p className="text-xs muted -mt-1 mb-3"><b>Subject:</b> {preview.subject}</p>
          <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="w-full h-[560px] border border-gray-200 rounded-lg bg-white" />
        </Card>
      </div>}
    </div>

    <div className="mt-6"><Card title="Recently sent">
      {!data?.log.length ? <Empty>No emails have been sent yet.</Empty> : <Table><thead><tr><Th>When</Th><Th>Email</Th><Th>To</Th><Th>Order</Th><Th>Result</Th></tr></thead><tbody>
        {data.log.map((r) => <tr key={r.id}>
          <Td className="whitespace-nowrap">{when(r.created_at)}</Td><Td>{getEvent(r.event_key)?.label ?? r.event_key}</Td><Td>{r.to_email}</Td><Td>{r.order_number ?? '-'}</Td>
          <Td>{r.status === 'sent' ? <Badge tone="green">Sent</Badge> : r.status === 'skipped' ? <Badge tone="amber">Skipped</Badge> : <Badge tone="red">Failed</Badge>}{r.error && <span className="block text-xs muted mt-1 max-w-xs">{r.error}</span>}</Td></tr>)}
      </tbody></Table>}
    </Card></div>
  </div>;
}
