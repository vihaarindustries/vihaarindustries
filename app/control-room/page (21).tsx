'use client';
import { useState } from 'react';
import { Alert, Btn, Card, Input, Label, PageHeader, Spinner, Textarea, useFlash } from '@/components/admin/ui';
import { useSetting } from '@/components/admin/useSetting';
import { errMsg } from '@/lib/admin/client';

type Cfg = { enabled: boolean; name: string; greeting: string; suggestions: string[] };
export default function Page() {
  const cfg = useSetting<Cfg>('chatbot_config', { enabled: false, name: 'Vihaar Assistant', greeting: '', suggestions: [] });
  const kb = useSetting<{ text: string }>('chatbot_knowledge', { text: '' });
  const [busy, setBusy] = useState(false); const { show, node } = useFlash();
  async function submit() {
    setBusy(true);
    try {
      await cfg.save({ ...cfg.value, suggestions: cfg.value.suggestions.map((s) => s.trim()).filter(Boolean).slice(0, 6) });
      await kb.save(kb.value); show('success', 'Chatbot settings saved.');
    } catch (e) { show('error', errMsg(e)); } finally { setBusy(false); }
  }
  if (cfg.loading || kb.loading) return <Spinner />;
  return <div><PageHeader title="AI chatbot" subtitle="A website assistant powered by Google Gemini. It answers from your product list and the facts you write below." actions={<Btn busy={busy} onClick={submit}>Save</Btn>} />
    {node && <div className="mb-4">{node}</div>}
    <div className="mb-4"><Alert tone="warn"><b>Setup:</b> the chat only works after your developer adds <code>GEMINI_API_KEY</code> to the server environment (see Integrations). Until then, visitors who open the chat are asked to use the enquiry form.</Alert></div>
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Behaviour">
        <label className="flex items-start gap-2.5 text-sm font-semibold mb-5"><input type="checkbox" className="mt-0.5 w-4 h-4 accent-[#00994d]" checked={cfg.value.enabled} onChange={(e) => cfg.setValue({ ...cfg.value, enabled: e.target.checked })} /><span>Show the chat button on the website<span className="block text-xs font-normal muted">Switch off to hide it instantly.</span></span></label>
        <div className="space-y-4">
          <Label>Assistant name<Input maxLength={40} value={cfg.value.name} onChange={(e) => cfg.setValue({ ...cfg.value, name: e.target.value })} /></Label>
          <Label>Greeting<Textarea rows={3} maxLength={300} value={cfg.value.greeting} onChange={(e) => cfg.setValue({ ...cfg.value, greeting: e.target.value })} /></Label>
          <Label help="One per line, up to 6. Shown as tap-to-ask buttons.">Suggested questions<Textarea rows={4} value={cfg.value.suggestions.join('\n')} onChange={(e) => cfg.setValue({ ...cfg.value, suggestions: e.target.value.split('\n').slice(0, 6) })} /></Label>
        </div>
      </Card>
      <Card title="What the assistant knows">
        <Label help="Plain facts only: locations, certifications, lead times, minimum orders, export countries. The assistant never invents prices. This text is private and only used by the assistant.">Business facts<Textarea rows={14} maxLength={6000} value={kb.value.text} onChange={(e) => kb.setValue({ text: e.target.value })} placeholder={'e.g.\nWe are based in ...\nMinimum export order is ...\nWe ship to ...'} /></Label>
        <p className="text-xs muted mt-2 text-right">{kb.value.text.length}/6000</p>
      </Card>
    </div></div>;
}
