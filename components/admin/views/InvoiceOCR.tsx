'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { rpc, errMsg } from '@/lib/admin/client';
import { useRefOptions } from '../FormFields';
import { Alert, Btn, Input, Label, Select, Textarea } from '../ui';
import { fmtMoney } from '@/lib/format';

type Line = { product_id: string; description: string; quantity: string; cost: string; tax: string };
type Draft = {
  name: string; type: string; blob: Blob; text: string; supplier: string; location: string;
  invoiceNo: string; invoiceDate: string; invoiceTotal: string; shipping: string; notes: string; lines: Line[]; hash: string;
};

type TesseractWindow = Window & { Tesseract?: any; pdfjsLib?: any };
const DB_NAME = 'vihaar-private-invoice-drafts';
const STORE = 'drafts';
const DRAFT_KEY = 'current';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open browser storage.'));
  });
}
async function dbGet(): Promise<Draft | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => { const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(DRAFT_KEY); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); req.transaction?.addEventListener('complete', () => db.close()); });
}
async function dbPut(value: Draft): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(value, DRAFT_KEY); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not save the local draft.')); }; });
}
async function dbDelete(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(DRAFT_KEY); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => { db.close(); reject(tx.error ?? new Error('Could not delete the local draft.')); }; });
}
function loadScript(src: string, marker: () => boolean): Promise<void> {
  if (marker()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-vihaar-src="${src}"]`) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    const done = () => marker() ? resolve() : reject(new Error('OCR library did not initialise.'));
    script.onload = done; script.onerror = () => reject(new Error('Could not load the local OCR engine. Check your internet connection and retry.'));
    if (!existing) { script.src = src; script.async = true; script.dataset.vihaarSrc = src; document.head.appendChild(script); }
  });
}
async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function parseInvoice(text: string) {
  const no = text.match(/(?:invoice\s*(?:no\.?|number|#)|bill\s*(?:no\.?|number|#))\s*[:#-]?\s*([A-Z0-9\-/]{3,40})/i)?.[1] ?? '';
  const rawDate = text.match(/(?:invoice\s*date|bill\s*date|date)\s*[:#-]?\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{4}-\d{2}-\d{2})/i)?.[1] ?? '';
  let invoiceDate = '';
  if (rawDate) {
    const iso = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) invoiceDate = rawDate;
    else { const m = rawDate.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/); if (m) { const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]); const d = new Date(year, Number(m[2]) - 1, Number(m[1])); if (d.getFullYear() === year && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1])) invoiceDate = `${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; } }
  }
  const totalMatch = text.match(/(?:grand\s*total|invoice\s*total|net\s*payable|amount\s*payable|total\s*amount|total\s*due)\s*[:₹ ]*([0-9,]+(?:\.[0-9]{1,2})?)/i);
  const invoiceTotal = totalMatch?.[1]?.replace(/,/g, '') ?? '';
  return { invoiceNo: no, invoiceDate, invoiceTotal };
}
async function extractText(file: File, onProgress: (v: string) => void): Promise<string> {
  const w = window as TesseractWindow;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => !!(window as TesseractWindow).pdfjsLib);
    const pdfjs = w.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let p = 1; p <= Math.min(pdf.numPages, 20); p++) {
      onProgress(`Reading PDF text · page ${p} of ${Math.min(pdf.numPages, 20)}`);
      const page = await pdf.getPage(p); const content = await page.getTextContent();
      text += `\n${content.items.map((item: any) => item.str ?? '').join(' ')}\n`;
    }
    if (text.replace(/\s/g, '').length > 40) return text;
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => !!(window as TesseractWindow).Tesseract);
    const ocr: string[] = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 5); p++) {
      onProgress(`Scanning PDF · page ${p} of ${Math.min(pdf.numPages, 5)}`);
      const page = await pdf.getPage(p); const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const result = await w.Tesseract.recognize(canvas, 'eng'); ocr.push(result.data.text); canvas.width = 0; canvas.height = 0;
    }
    return ocr.join('\n');
  }
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => !!(window as TesseractWindow).Tesseract);
  onProgress('Recognising text in the image');
  const result = await w.Tesseract.recognize(file, 'eng');
  return result.data.text as string;
}
const emptyLine = (): Line => ({ product_id: '', description: '', quantity: '1', cost: '', tax: '5' });

export default function InvoiceOCR() {
  const suppliers = useRefOptions('suppliers', 'name');
  const products = useRefOptions('products', 'name');
  const locations = useRefOptions('inventory_locations', 'name');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [confirmAccept, setConfirmAccept] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [restoreDone, setRestoreDone] = useState(false);

  useEffect(() => {
    let active = true;
    dbGet().then((saved) => { if (active && saved) { setDraft(saved); setNotice('Recovered a pending invoice draft from this browser.'); } }).catch(() => { if (active) setError('Browser storage is unavailable. Do not proceed until local storage works.'); }).finally(() => { if (active) setRestoreDone(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!draft) { setPreviewUrl(''); return; }
    const url = URL.createObjectURL(draft.blob); setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [draft?.blob]);
  const total = useMemo(() => draft?.lines.reduce((sum, l) => {
    const base = (Number(l.quantity) || 0) * (Number(l.cost) || 0) * 100;
    return sum + Math.round(base) + Math.round(Math.round(base) * (Number(l.tax) || 0) / 100);
  }, 0) ?? 0, [draft?.lines]);
  const update = (patch: Partial<Draft>) => setDraft((old) => old ? { ...old, ...patch } : old);
  useEffect(() => {
    if (!draft || !restoreDone || busy) return;
    const save = window.setTimeout(() => { dbPut(draft).catch(() => setError('Could not persist this draft in browser storage. Export/keep your original file and do not close this tab.')); }, 250);
    return () => window.clearTimeout(save);
  }, [draft, restoreDone, busy]);

  async function onFile(file?: File) {
    if (!file) return;
    setError(''); setNotice(''); setStatus('Preparing local draft…'); setBusy(true); setConfirmAccept(false);
    if (file.size > 20 * 1024 * 1024) { setBusy(false); setStatus(''); setError('File is larger than 20 MB. Please compress it or split the PDF.'); return; }
    if (!(file.type === 'application/pdf' || file.type.startsWith('image/'))) { setBusy(false); setStatus(''); setError('Please select a PDF or an image (JPG, PNG, WebP).'); return; }
    try {
      const hash = await sha256(file);
      let next: Draft = { name: file.name.slice(0, 255), type: file.type, blob: file, text: '', supplier: '', location: '', invoiceNo: '', invoiceDate: '', invoiceTotal: '', shipping: '0', notes: '', lines: [emptyLine()], hash };
      setDraft(next); await dbPut(next);
      const text = await extractText(file, setStatus);
      const parsed = parseInvoice(text);
      next = { ...next, text, ...parsed };
      setDraft(next); await dbPut(next);
      setStatus('OCR complete. Please verify every field against the original bill.');
    } catch (e) { setError(errMsg(e)); setStatus('OCR did not complete. You can retry or enter the values manually.'); }
    finally { setBusy(false); }
  }
  async function runOcrAgain() {
    if (!draft) return;
    setBusy(true); setError('');
    try { const text = await extractText(new File([draft.blob], draft.name, { type: draft.type }), setStatus); const parsed = parseInvoice(text); const next = { ...draft, text, ...(!draft.invoiceNo ? { invoiceNo: parsed.invoiceNo } : {}), ...(!draft.invoiceDate ? { invoiceDate: parsed.invoiceDate } : {}), ...(!draft.invoiceTotal ? { invoiceTotal: parsed.invoiceTotal } : {}) }; setDraft(next); await dbPut(next); setStatus('OCR refreshed. Check all values manually.'); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  async function accept() {
    if (!draft) return;
    setError(''); setNotice('');
    if (!draft.supplier) return setError('Select the supplier first.');
    if (!draft.invoiceNo.trim()) return setError('Enter the supplier invoice number.');
    if (!draft.lines.length || draft.lines.some((l) => !l.product_id || !(Number(l.quantity) > 0) || !l.cost.trim() || !Number.isFinite(Number(l.cost)) || Number(l.cost) < 0 || !l.tax.trim() || !Number.isFinite(Number(l.tax)) || Number(l.tax) < 0 || Number(l.tax) > 100)) return setError('Each line must have a product, positive quantity, valid cost and GST rate.');
    if (draft.invoiceTotal.trim() && (!Number.isFinite(Number(draft.invoiceTotal)) || Number(draft.invoiceTotal) < 0)) return setError('Check the invoice total amount.');
    if (draft.invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.invoiceDate)) return setError('Check the invoice date.');
    if (!confirmAccept) return setError('Tick the review confirmation before accepting this bill.');
    setBusy(true); setStatus('Saving approved purchase to Supabase…');
    try {
      const items = draft.lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity), unit_cost_minor: Math.round(Number(l.cost) * 100), tax_rate: Number(l.tax) || 0 }));
      const result = await rpc<string>('create_purchase', {
        p_supplier: draft.supplier, p_location: draft.location || undefined, p_invoice: draft.invoiceNo.trim(),
        p_invoice_date: draft.invoiceDate || undefined, p_shipping_minor: Math.round(Math.max(0, Number(draft.shipping) || 0) * 100),
        p_notes: [draft.notes.trim(), `Imported from local file: ${draft.name}`].filter(Boolean).join('\n').slice(0, 2000),
        p_items: items, p_source_file_name: draft.name, p_source_file_sha256: draft.hash,
      });
      // The original is deleted only after the server confirms the purchase was created.
      await dbDelete(); setDraft(null); setConfirmAccept(false); setStatus(''); setNotice(`Purchase saved successfully. Reference: ${typeof result === 'string' ? result : 'created'}. The temporary browser copy was deleted. Keep your archived original file: ${draft.name}`);
    } catch (e) { setError(`The bill was not confirmed as saved. The local draft has been retained. ${errMsg(e)}`); setStatus(''); }
    finally { setBusy(false); }
  }
  async function discard() {
    if (!confirm('Delete this temporary invoice and its OCR draft from this browser? Make sure you have the original file archived on your device.')) return;
    try { await dbDelete(); setDraft(null); setConfirmAccept(false); setError(''); setNotice('Temporary invoice draft deleted from this browser.'); setStatus(''); }
    catch (e) { setError(errMsg(e)); }
  }

  if (!restoreDone) return <div className="p-6 text-sm muted"><Loader2 className="inline mr-2 animate-spin" size={16} />Checking browser-local drafts…</div>;
  return <div className="space-y-5">
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><div className="flex gap-2 font-semibold"><ShieldCheck size={18} /> Local document handling</div><p className="mt-1">The bill is processed in this browser and is not uploaded to Supabase Storage or an OCR API. OCR software and its language model may be downloaded from a static CDN; the invoice file itself is not sent there. Browser storage is temporary, so keep your own archived copy.</p></div>
    {error && <Alert tone="error">{error}</Alert>}{notice && <Alert tone="success">{notice}</Alert>}
    {status && <p className="text-sm muted" aria-live="polite">{busy && <Loader2 className="inline mr-2 animate-spin" size={15} />}{status}</p>}
    {!draft ? <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
      <FileText size={36} className="mx-auto text-gray-400" /><h3 className="mt-3 text-lg font-bold">Import a supplier bill</h3><p className="muted mx-auto mt-1 max-w-xl text-sm">Choose a PDF or photo up to 20 MB. The original stays in browser-local storage while you review the extracted values.</p>
      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; void onFile(f); e.currentTarget.value = ''; }} />
      <Btn className="mt-5" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={16} />Choose bill</Btn>
    </div> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-3"><div className="min-w-0"><p className="text-sm font-semibold break-all">{draft.name}</p><p className="muted text-xs">SHA-256: {draft.hash.slice(0, 16)}… · Temporary browser draft</p></div><div className="flex flex-wrap gap-2"><Btn variant="outline" size="sm" onClick={runOcrAgain} disabled={busy}><RefreshCw size={14} />Run OCR again</Btn><Btn variant="outline" size="sm" onClick={discard} disabled={busy}><Trash2 size={14} />Discard</Btn><Btn variant="outline" size="sm" onClick={() => { setDraft(null); setError(''); setStatus(''); fileRef.current?.click(); }} disabled={busy}><X size={14} />Replace file</Btn></div></div>
      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; void onFile(f); e.currentTarget.value = ''; }} />
      <div className="grid xl:grid-cols-2 gap-5 items-start">
        <section className="rounded-xl border border-gray-200 overflow-hidden"><div className="border-b border-gray-200 p-3"><h3 className="font-bold">Original bill</h3><p className="muted text-xs">Compare the source document with every field before accepting.</p></div>{previewUrl && (draft.type === 'application/pdf' || draft.name.toLowerCase().endsWith('.pdf') ? <iframe title="Original invoice PDF" src={previewUrl} className="h-[680px] w-full bg-gray-100" /> : <div className="p-3 bg-gray-50"><img src={previewUrl} alt="Original invoice preview" className="mx-auto max-h-[680px] max-w-full object-contain" /></div>)}</section>
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 space-y-4"><div><h3 className="font-bold">Review extracted values</h3><p className="muted text-xs">OCR is a suggestion only. Correct it manually; nothing is posted until you accept.</p></div>
            <Label>Supplier <Select value={draft.supplier} onChange={(e) => update({ supplier: e.target.value })}><option value="">Choose supplier…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Label>
            <div className="grid sm:grid-cols-2 gap-3"><Label>Supplier invoice number<Input maxLength={60} value={draft.invoiceNo} onChange={(e) => update({ invoiceNo: e.target.value })} /></Label><Label>Invoice date<Input type="date" value={draft.invoiceDate} onChange={(e) => update({ invoiceDate: e.target.value })} /></Label><Label help="OCR suggestion only; verify on original">Invoice total on bill (₹)<Input inputMode="decimal" value={draft.invoiceTotal} onChange={(e) => update({ invoiceTotal: e.target.value })} /></Label></div>
            <Label>Receive into (optional)<Select value={draft.location} onChange={(e) => update({ location: e.target.value })}><option value="">Default location</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Label>
            <div className="space-y-3"><div className="flex items-center justify-between"><h4 className="font-semibold text-sm">Invoice line items</h4><Btn size="sm" variant="outline" onClick={() => update({ lines: [...draft.lines, emptyLine()] })}>Add line</Btn></div>
              {draft.lines.map((line, i) => <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-3"><div className="flex justify-between gap-2"><p className="text-xs font-bold uppercase text-gray-500">Line {i + 1}</p><button className="text-xs text-red-600" onClick={() => update({ lines: draft.lines.filter((_, j) => i !== j) })} disabled={draft.lines.length === 1}>Remove</button></div>
                <Label>Match to product<Select value={line.product_id} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, product_id: e.target.value } : l) })}><option value="">Choose product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Label>
                <Label>Bill description (for reference)<Input maxLength={160} value={line.description} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, description: e.target.value } : l) })} /></Label>
                <div className="grid grid-cols-3 gap-2"><Label>Quantity<Input inputMode="decimal" value={line.quantity} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, quantity: e.target.value } : l) })} /></Label><Label>Unit cost ₹<Input inputMode="decimal" value={line.cost} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, cost: e.target.value } : l) })} /></Label><Label>GST %<Input inputMode="decimal" value={line.tax} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, tax: e.target.value } : l) })} /></Label></div>
              </div>)}
            </div>
            <div className="grid sm:grid-cols-2 gap-3"><Label>Freight / shipping ₹<Input inputMode="decimal" value={draft.shipping} onChange={(e) => update({ shipping: e.target.value })} /></Label><div className="rounded-lg bg-gray-50 p-3"><p className="muted text-xs">Calculated total from reviewed lines</p><p className="text-lg font-bold">{fmtMoney(total + Math.round(Math.max(0, Number(draft.shipping) || 0) * 100))}</p><p className="muted text-xs">OCR total on bill: {draft.invoiceTotal ? fmtMoney(Math.round(Number(draft.invoiceTotal) * 100)) : 'Not detected'} · Compare against the original; totals are not auto-adjusted.</p>{draft.invoiceTotal && Math.abs((Number(draft.invoiceTotal) * 100) - (total + Math.round(Math.max(0, Number(draft.shipping) || 0) * 100))) > 100 && <p className="text-xs font-semibold text-amber-700">The reviewed line total differs from the OCR total by more than ₹1. Check taxes, freight and line items before approval.</p>}</div></div>
            <Label>Notes (optional)<Textarea rows={2} maxLength={1500} value={draft.notes} onChange={(e) => update({ notes: e.target.value })} /></Label></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3"><h3 className="font-bold text-amber-950">Final human approval</h3><p className="text-sm text-amber-950">Accepting creates a purchase order in Supabase with the reviewed supplier, product lines, invoice number/date and source filename. It does not receive stock or record a supplier payment. Those remain separate actions.</p><label className="flex items-start gap-2 text-sm text-amber-950"><input type="checkbox" checked={confirmAccept} onChange={(e) => setConfirmAccept(e.target.checked)} className="mt-1" /><span>I compared the original bill against all fields and confirm these values are correct.</span></label><Btn onClick={accept} disabled={busy || !confirmAccept}><CheckCircle2 size={16} />Accept and save purchase</Btn></div>
        </section>
      </div>
      <details className="rounded-xl border border-gray-200 p-4"><summary className="cursor-pointer font-semibold">View raw OCR text</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{draft.text || 'No OCR text yet.'}</pre></details>
    </>}
    <p className="muted flex gap-2 text-xs"><AlertCircle size={14} className="shrink-0" />Use a trusted device and browser profile. Anyone with access to your unlocked Windows account and Chrome profile may be able to access locally stored drafts.</p>
  </div>;
}
