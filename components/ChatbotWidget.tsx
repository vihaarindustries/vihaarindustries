'use client';
import { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };
export type ChatConfig = { enabled?: boolean; name?: string; greeting?: string; suggestions?: string[] };

export default function ChatbotWidget({ config }: { config: ChatConfig }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, open]);
  if (!config.enabled) return null;

  async function send(content: string) {
    const q = content.trim();
    if (!q || busy) return;
    const next: Msg[] = [...msgs, { role: 'user', content: q }];
    setMsgs(next); setText(''); setBusy(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }) });
      const j = await res.json();
      setMsgs([...next, { role: 'assistant', content: res.ok ? j.reply : j.error || 'Something went wrong. Please try the Enquiry page.' }]);
    } catch { setMsgs([...next, { role: 'assistant', content: 'Connection problem. Please try again.' }]); }
    setBusy(false);
  }

  return <>
    {!open && <button onClick={() => setOpen(true)} aria-label="Open chat" className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-vihaar-green text-white shadow-xl flex items-center justify-center hover:bg-vihaar-deep"><MessageCircle size={24} /></button>}
    {open && <div role="dialog" aria-label="Chat" className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] sm:w-[360px] h-[480px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-black/10 flex flex-col overflow-hidden">
      <div className="bg-[#151915] text-white px-4 py-3 flex items-center justify-between"><div><div className="font-bold text-sm">{config.name || 'Vihaar Assistant'}</div><div className="text-[10px] text-gray-400">AI assistant · may make mistakes</div></div><button onClick={() => setOpen(false)} aria-label="Close chat"><X size={18} /></button></div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm bg-[#f7f7f1]">
        <div className="bg-white border border-gray-200 rounded-xl rounded-tl-sm p-3 max-w-[85%]">{config.greeting || 'Hello! How can I help?'}</div>
        {!msgs.length && <div className="flex flex-wrap gap-2">{(config.suggestions ?? []).map((s) => <button key={s} onClick={() => send(s)} className="text-xs border border-vihaar-green text-vihaar-deep rounded-full px-3 py-1.5 hover:bg-[#e3f4e9]">{s}</button>)}</div>}
        {msgs.map((m, i) => <div key={i} className={`max-w-[85%] p-3 rounded-xl whitespace-pre-wrap ${m.role === 'user' ? 'ml-auto bg-vihaar-green text-white rounded-tr-sm' : 'bg-white border border-gray-200 rounded-tl-sm'}`}>{m.content}</div>)}
        {busy && <div className="text-xs text-gray-500">Typing…</div>}
        <div ref={end} />
      </div>
      <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="p-3 border-t border-gray-200 flex gap-2 bg-white">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={800} placeholder="Ask about products or export…" className="field !py-2 text-sm" aria-label="Your message" />
        <button disabled={busy || !text.trim()} className="btn !px-3 disabled:opacity-50" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>}
  </>;
}
