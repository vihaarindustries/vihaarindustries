'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileText, Loader2, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { rpc, errMsg } from '@/lib/admin/client';
import { useRefOptions } from '../FormFields';
import { Alert, Btn, Input, Label, Select, Textarea } from '../ui';
import { fmtMoney } from '@/lib/format';

type Line = { product_id: string; description: string; categoryName: string; quantity: string; cost: string; tax: string };
type Draft = {
  name: string; type: string; blob: Blob; text: string; supplier: string; supplierName: string; location: string;
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
    let script = document.querySelector(`script[data-vihaar-src="${src}"]`) as HTMLScriptElement | null;
    if (script?.dataset.failed === 'true') { script.remove(); script = null; }
    if (script?.dataset.loaded === 'true') {
      if (marker()) resolve(); else reject(new Error(`OCR asset loaded but did not initialise: ${new URL(src).hostname}. Check the browser Console for Content Security Policy or worker errors.`));
      return;
    }
    const isNew = !script;
    if (!script) {
      script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.vihaarSrc = src;
    }
    const current = script;
    const cleanup = () => { current.removeEventListener('load', loaded); current.removeEventListener('error', failed); };
    const loaded = () => { current.dataset.loaded = 'true'; cleanup(); marker() ? resolve() : reject(new Error(`OCR library loaded but did not initialise: ${new URL(src).hostname}.`)); };
    const failed = () => { current.dataset.failed = 'true'; cleanup(); reject(new Error(`Could not load OCR asset from ${new URL(src).hostname}. Check the browser Console and network/ad-blocker settings.`)); };
    current.addEventListener('load', loaded, { once: true });
    current.addEventListener('error', failed, { once: true });
    if (isNew) document.head.appendChild(current);
  });
}
async function sha256(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function parseInvoice(text: string) {
  // Keep OCR rows intact: invoice layouts frequently put headings and values on adjacent columns.
  const clean = text.replace(/[\u00a0\u2007\u202f]/g, ' ').replace(/\r/g, '\n');
  const lines = clean.split(/\n/).map((x) => x.replace(/[|¦]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  const normal = (s: string) => s.replace(/[,₹]/g, '').trim();
  const parseDate = (raw: string) => {
    const value = raw.trim().replace(/,/g, '').replace(/\s+/g, '-');
    let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = value.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    if (m) {
      const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    m = value.match(/^(\d{1,2})-(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*-?(\d{2,4})$/i);
    if (m) {
      const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12' };
      const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
      return `${y}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
    }
    return '';
  };
  // First try a label and nearby value; this avoids accidentally treating a date or heading as the number.
  let invoiceNo = '';
  const noLabels = /(?:invoice\s*(?:no\.?|number|#)|bill\s*(?:no\.?|number|#)|document\s*no\.?)/i;
  for (let i = 0; i < lines.length && !invoiceNo; i++) {
    if (!noLabels.test(lines[i])) continue;
    const tail = lines[i].split(noLabels).slice(1).join(' ').replace(/^\s*[:#=-]?\s*/, ' ');
    const candidates = [tail, ...lines.slice(i, i + 3)].join(' ');
    const found = candidates.match(/\b([A-Z]{1,8}[-/]\d{1,12}(?:[-/]\d{1,8})?|[A-Z]{1,5}\d{1,12})\b/i);
    if (found && !/^(?:GST|HSN|SAC|NO)$/i.test(found[1])) invoiceNo = found[1];
  }
  // Common Tally layouts: “Invoice No. Dated” in the heading row, then “DO-18 13-Sep-26”.
  if (!invoiceNo) {
    const datedAt = lines.findIndex((x) => /\bdated\b/i.test(x));
    for (const row of lines.slice(Math.max(0, datedAt), Math.max(0, datedAt) + 3)) {
      const found = row.match(/\b([A-Z]{1,8}[-/]\d{1,12}(?:[-/]\d{1,8})?|[A-Z]{1,5}\d{1,12})\b/i);
      if (found && !/^(?:GST|HSN|SAC|NO)$/i.test(found[1])) { invoiceNo = found[1]; break; }
    }
  }
  let invoiceDate = '';
  const datePatterns = [
    /(?:invoice\s*date|bill\s*date|dated|date)\s*[:#=-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}[- ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[- ,]?\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    /\b(\d{1,2}[- ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*[- ,]?\d{2,4})\b/i,
  ];
  for (const re of datePatterns) { const m = all.match(re); if (m) { invoiceDate = parseDate(m[1]); if (invoiceDate) break; } }

  // Totals are ambiguous in OCR, so prefer explicit “Amount Chargeable”/“Total” rows over currency mentions.
  let invoiceTotal = '';
  const totalLabels = /(?:grand\s*total|invoice\s*total|net\s*payable|amount\s*payable|total\s*amount|total\s*due|amount\s*chargeable(?:\s*\(.*?\))?|\btotal\b)/i;
  for (const row of [...lines].reverse()) {
    if (!totalLabels.test(row) || /taxable\s*value|hsn|sac|amount\s*in\s*words/i.test(row)) continue;
    const nums = row.match(/\d[\d,]*(?:\.\d{1,2})?/g) ?? [];
    if (nums.length) { const candidate = nums[nums.length - 1].replace(/,/g, ''); if (Number(candidate) >= 0) { invoiceTotal = candidate; break; } }
  }

  // Supplier usually appears near the top, before the “Buyer/Bill to” section. Remove adjacent headings.
  const buyerAt = lines.findIndex((x) => /^(?:buyer|bill\s*to|consignee|ship\s*to)\b/i.test(x));
  const headerLines = lines.slice(0, buyerAt >= 0 ? buyerAt : Math.min(lines.length, 18));
  const excludedSupplier = /^(?:bill\s+of\s+supply|tax\s+invoice|invoice|original|duplicate|triplicate|supplier|seller|buyer|consignee|ship\s+to|bill\s+to|invoice\s*no|dated|date|mode|terms|delivery|gstin|gst\s*no|state\s*name|e-?mail|phone|mobile|www\.)\b/i;
  const supplierName = headerLines.map((row) => row.replace(/\s+(?:invoice\s*(?:no\.?|number|#)|dated)\b.*$/i, '').trim())
    .find((row) => row.length >= 3 && row.length <= 120 && !excludedSupplier.test(row) && !/^\d/.test(row) && !/@/.test(row) && !/\b(?:gstin|state\s*name|code\s*:\s*\d{2})\b/i.test(row)) ?? '';

  const itemLines: Array<{ description: string; quantity: string; cost: string; tax: string; categoryName: string }> = [];
  const skip = /^(?:subtotal|sub\s*total|grand\s*total|total|cgst|sgst|igst|tax|round\s*off|amount\s*in\s*words|bank\s*details|terms|invoice\s*no|date|hsn|sac|gstin|taxable\s*value|discount|freight|shipping|payment\s*terms|due\s*date|company's\s*bank|declaration)\b/i;
  const seen = new Set<string>();
  for (const row of lines) {
    if (skip.test(row) || itemLines.length >= 60) continue;
    // Remove table serial number; HSN can be embedded between the description and quantity.
    let candidate = row.replace(/^\s*\d{1,3}[.)]?\s+/, '').trim();
    if (!/\b(?:kg|kgs|g|gm|gms|pcs|nos|box|boxes|mt|tonne|ltr|litre|unit|units)\b/i.test(candidate)) continue;
    const nums = [...candidate.matchAll(/\d[\d,]*(?:\.\d{1,4})?/g)];
    if (nums.length < 3) continue;
    // Find the last three numeric values as quantity, rate, amount; ignore a preceding 4-8 digit HSN.
    let qIndex = nums.length - 3;
    if (nums[qIndex] && /^\d{4,8}$/.test(nums[qIndex][0].replace(/,/g, '')) && nums.length >= 4) qIndex++;
    const q = nums[qIndex], rate = nums[qIndex + 1], amount = nums[qIndex + 2];
    if (!q || !rate || !amount) continue;
    const quantity = normal(q[0]); const cost = normal(rate[0]);
    const prefix = candidate.slice(0, q.index).trim().replace(/\b\d{4,8}\b/g, '').replace(/\s+/g, ' ').trim();
    const description = prefix.replace(/\s+(?:₹|rs\.?|inr)$/i, '').trim();
    if (!description || description.length > 120 || Number(quantity) <= 0 || Number(cost) < 0) continue;
    if (/\b(?:invoice|total|taxable|cgst|sgst|igst|gst|phone|mobile|balance|round\s*off|amount\s*chargeable|bank)\b/i.test(description)) continue;
    // Arithmetic is a confidence hint only. If rate × quantity matches the final numeric column, retain the line.
    const lineAmount = Number(normal(amount[0]));
    const computed = Number(quantity) * Number(cost);
    if (!Number.isFinite(lineAmount) || lineAmount < 0 || Math.abs(computed - lineAmount) > Math.max(2, lineAmount * 0.03)) continue;
    const key = `${description.toLowerCase()}|${quantity}|${cost}`;
    if (seen.has(key)) continue;
    seen.add(key);
    itemLines.push({ description, quantity, cost, tax: '0', categoryName: 'Imported Items' });
  }
  return { invoiceNo, invoiceDate, invoiceTotal, supplierName, itemLines };
}

async function createOcrWorker(onProgress: (v: string) => void): Promise<any> {
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js', () => !!(window as TesseractWindow).Tesseract);
  const T = (window as TesseractWindow).Tesseract;
  if (!T?.createWorker) throw new Error('Tesseract OCR worker is unavailable. Refresh the page and check whether the browser blocked worker or language-data requests.');
  return T.createWorker('eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: (m: any) => {
      if (m?.status) onProgress(`OCR: ${m.status}${typeof m.progress === 'number' ? ` ${Math.round(m.progress * 100)}%` : ''}`);
    },
  });
}

async function extractText(file: File, onProgress: (v: string) => void): Promise<string> {
  const w = window as TesseractWindow;
  let pdf: any = null;
  let pageCount = 1;
  let pdfjs: any = null;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', () => !!(window as TesseractWindow).pdfjsLib);
    pdfjs = w.pdfjsLib;
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    pageCount = Math.min(pdf.numPages, 20);
  }
  let worker: any = null;
  const resultPages: string[] = [];
  try {
    for (let p = 1; p <= pageCount; p++) {
      let digitalText = '';
      let canvas: HTMLCanvasElement | null = null;
      if (pdf) {
        onProgress(`Reading PDF text · page ${p} of ${pageCount}`);
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        const rows = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of content.items as any[]) {
          if (typeof item.str !== 'string' || !item.str.trim()) continue;
          const x = Number(item.transform?.[4] ?? 0);
          const y = Math.round(Number(item.transform?.[5] ?? 0) / 3) * 3;
          const row = rows.get(y) ?? []; row.push({ x, text: item.str.trim() }); rows.set(y, row);
        }
        digitalText = Array.from(rows.entries()).sort((a,b) => b[0] - a[0]).map(([, row]) => row.sort((a,b) => a.x - b.x).map(part => part.text).join(' ')).join('\n');
        const numericRows = digitalText.split(/\n/).filter(line => (line.match(/[0-9][0-9,]*(?:\.\d+)?/g) ?? []).length >= 3).length;
        // Mixed PDFs often have selectable headers but scanned item tables. OCR pages that lack meaningful selectable text or item rows.
        const needsOcr = digitalText.replace(/\s/g, '').length < 100 || numericRows < 1;
        if (!needsOcr) { resultPages.push(digitalText); continue; }
        const viewport = page.getViewport({ scale: 2.0 });
        canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not prepare a local canvas for this PDF page.');
        await page.render({ canvasContext: ctx, viewport }).promise;
      } else {
        canvas = document.createElement('canvas');
        const img = new Image();
        const imageUrl = URL.createObjectURL(file);
        try {
          await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('The selected image could not be decoded.')); img.src = imageUrl; });
          const scale = Math.min(2.5, Math.max(0.25, 2400 / Math.max(img.naturalWidth, img.naturalHeight)));
          canvas.width = Math.ceil(img.naturalWidth * scale); canvas.height = Math.ceil(img.naturalHeight * scale);
          const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Could not prepare a local canvas for OCR.');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } finally { URL.revokeObjectURL(imageUrl); }
      }
      if (!worker) worker = await createOcrWorker(onProgress);
      onProgress(`Recognising invoice text · page ${p} of ${pageCount}`);
      if (!canvas) throw new Error('Could not prepare this invoice page for OCR.');
      const ocrResult = await worker.recognize(canvas);
      const ocrText = String(ocrResult?.data?.text ?? '').trim();
      resultPages.push([digitalText, ocrText].filter(Boolean).join('\n'));
      if (canvas) { canvas.width = 0; canvas.height = 0; }
    }
  } finally {
    if (worker) await worker.terminate().catch(() => {});
  }
  const output = resultPages.join('\n\n').trim();
  if (output.replace(/\s/g, '').length < 10) throw new Error('No readable text was detected. Try a clearer scan or a higher-resolution photo. You can still enter invoice details manually.');
  return output;
}
const emptyLine = (): Line => ({ product_id: '', description: '', categoryName: 'Imported Items', quantity: '1', cost: '', tax: '0' });

export default function InvoiceOCR() {
  const suppliers = useRefOptions('suppliers', 'name');
  const products = useRefOptions('products', 'name');
  const categories = useRefOptions('categories', 'name');
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
    dbGet().then((saved) => { if (active && saved) { const restored = { ...saved, lines: (saved.lines ?? []).map((line: Line) => ({ ...line, categoryName: line.categoryName || 'Imported Items' })) }; setDraft(restored); setNotice('Recovered a pending invoice draft from this browser.'); } }).catch(() => { if (active) setError('Browser storage is unavailable. Do not proceed until local storage works.'); }).finally(() => { if (active) setRestoreDone(true); });
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
      let next: Draft = { name: file.name.slice(0, 255), type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/*'), blob: file, text: '', supplier: '', supplierName: '', location: '', invoiceNo: '', invoiceDate: '', invoiceTotal: '', shipping: '0', notes: '', lines: [emptyLine()], hash };
      setDraft(next); await dbPut(next);
      const text = await extractText(file, setStatus);
      const parsed = parseInvoice(text);
      const matchingSupplier = suppliers.find((x) => x.label.trim().toLowerCase() === parsed.supplierName.trim().toLowerCase());
      const parsedLines: Line[] = parsed.itemLines.length ? parsed.itemLines.map((x) => { const existing = products.find((p) => p.label.trim().toLowerCase() === x.description.trim().toLowerCase()); return { product_id: existing?.id ?? '', description: x.description, categoryName: x.categoryName || 'Imported Items', quantity: x.quantity, cost: x.cost, tax: x.tax }; }) : [emptyLine()];
      next = { ...next, text, invoiceNo: parsed.invoiceNo, invoiceDate: parsed.invoiceDate, invoiceTotal: parsed.invoiceTotal, supplierName: parsed.supplierName, supplier: matchingSupplier?.id ?? '', lines: parsedLines }; 
      setDraft(next); await dbPut(next);
      setStatus(text.trim().length < 40 ? 'OCR returned very little text. Check the raw OCR text below, improve the scan, or enter fields manually.' : `OCR extracted ${text.trim().length} characters. Please verify every field against the original bill.`);
    } catch (e) { setError(errMsg(e)); setStatus('OCR did not complete. Open “View raw OCR text” and the browser Console (F12) to diagnose blocked worker/language assets. You can retry or enter values manually.'); }
    finally { setBusy(false); }
  }
  async function runOcrAgain() {
    if (!draft) return;
    setBusy(true); setError('');
    try { const text = await extractText(new File([draft.blob], draft.name, { type: draft.type }), setStatus); const parsed = parseInvoice(text); const matchingSupplier = suppliers.find((x) => x.label.trim().toLowerCase() === parsed.supplierName.trim().toLowerCase()); const next = { ...draft, text, ...(!draft.invoiceNo ? { invoiceNo: parsed.invoiceNo } : {}), ...(!draft.invoiceDate ? { invoiceDate: parsed.invoiceDate } : {}), ...(!draft.invoiceTotal ? { invoiceTotal: parsed.invoiceTotal } : {}), ...(!draft.supplierName ? { supplierName: parsed.supplierName } : {}), ...(!draft.supplier && matchingSupplier ? { supplier: matchingSupplier.id } : {}), ...(draft.lines.every((l) => !l.description.trim()) && parsed.itemLines.length ? { lines: parsed.itemLines.map((x) => { const existing = products.find((p) => p.label.trim().toLowerCase() === x.description.trim().toLowerCase()); return { product_id: existing?.id ?? '', description: x.description, categoryName: x.categoryName || 'Imported Items', quantity: x.quantity, cost: x.cost, tax: x.tax }; }) } : {}) }; setDraft(next); await dbPut(next); setStatus('OCR refreshed. Check all values manually.'); }
    catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  }
  async function accept() {
    if (!draft) return;
    setError(''); setNotice('');
    if (!draft.supplier && !draft.supplierName.trim()) return setError('Choose an existing supplier or enter the new supplier name.');
    if (!draft.invoiceNo.trim()) return setError('Enter the supplier invoice number.');
    if (!draft.lines.length || draft.lines.some((l) => (!l.product_id && (!l.description.trim() || !l.categoryName.trim())) || !(Number(l.quantity) > 0) || !l.cost.trim() || !Number.isFinite(Number(l.cost)) || Number(l.cost) < 0 || !l.tax.trim() || !Number.isFinite(Number(l.tax)) || Number(l.tax) < 0 || Number(l.tax) > 100)) return setError('Each line needs an existing product or a new product name, positive quantity, valid cost and GST rate.');
    if (draft.invoiceTotal.trim() && (!Number.isFinite(Number(draft.invoiceTotal)) || Number(draft.invoiceTotal) < 0)) return setError('Check the invoice total amount.');
    if (draft.invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(draft.invoiceDate)) return setError('Check the invoice date.');
    if (!confirmAccept) return setError('Tick the review confirmation before accepting this bill.');
    setBusy(true); setStatus('Saving approved purchase to Supabase…');
    try {
      const items = draft.lines.map((l) => ({ ...(l.product_id ? { product_id: l.product_id } : {}), product_name: l.description.trim(), category_name: l.categoryName.trim() || 'Imported Items', quantity: Number(l.quantity), unit_cost_minor: Math.round(Number(l.cost) * 100), tax_rate: Number(l.tax) || 0 }));
      const result = await rpc<string>('create_purchase_from_invoice', {
        p_supplier: draft.supplier || undefined, p_supplier_name: draft.supplierName.trim() || undefined, p_items: items, p_location: draft.location || undefined, p_invoice: draft.invoiceNo.trim(),
        p_invoice_date: draft.invoiceDate || undefined, p_shipping_minor: Math.round(Math.max(0, Number(draft.shipping) || 0) * 100),
        p_notes: [draft.notes.trim(), `Imported from local file: ${draft.name}`].filter(Boolean).join('\n').slice(0, 2000),
        p_source_file_name: draft.name, p_source_file_sha256: draft.hash,
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
    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><div className="flex gap-2 font-semibold"><ShieldCheck size={18} /> Local document handling</div><p className="mt-1">The bill is processed in this browser and is not uploaded to Supabase Storage or an OCR API. OCR code and English language data are downloaded from static CDNs; the invoice file itself is processed locally. Extraction is only a suggestion, and every field must be checked before approval. Browser storage is temporary, so keep your own archived copy.</p></div>
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
        <section className="rounded-xl border border-gray-200 overflow-hidden"><div className="border-b border-gray-200 p-3"><h3 className="font-bold">Original bill</h3><p className="muted text-xs">Compare the source document with every field before accepting.</p></div>{previewUrl && (draft.type === 'application/pdf' || draft.name.toLowerCase().endsWith('.pdf') ? <><iframe title="Original invoice PDF" src={previewUrl} className="h-[680px] w-full bg-gray-100" /><div className="border-t p-2 text-sm"><a className="underline" href={previewUrl} target="_blank" rel="noreferrer">If the PDF preview is blocked, open the bill in a new tab</a></div></> : <div className="p-3 bg-gray-50"><img src={previewUrl} alt="Original invoice preview" className="mx-auto max-h-[680px] max-w-full object-contain" /></div>)}</section>
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 p-4 space-y-4"><div><h3 className="font-bold">Review extracted values</h3><p className="muted text-xs">OCR is a suggestion only. Correct it manually; nothing is posted until you accept.</p></div>
            <div className="grid sm:grid-cols-2 gap-3"><Label>Existing supplier (if found)<Select value={draft.supplier} onChange={(e) => update({ supplier: e.target.value })}><option value="">Create from name below…</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</Select></Label><Label help="If this supplier is new, confirm the name exactly as shown on the bill">Supplier name<Input maxLength={180} value={draft.supplierName} onChange={(e) => update({ supplierName: e.target.value, ...(e.target.value.trim() ? { supplier: '' } : {}) })} /></Label></div>
            <div className="grid sm:grid-cols-2 gap-3"><Label>Supplier invoice number<Input maxLength={60} value={draft.invoiceNo} onChange={(e) => update({ invoiceNo: e.target.value })} /></Label><Label>Invoice date<Input type="date" value={draft.invoiceDate} onChange={(e) => update({ invoiceDate: e.target.value })} /></Label><Label help="OCR suggestion only; verify on original">Invoice total on bill (₹)<Input inputMode="decimal" value={draft.invoiceTotal} onChange={(e) => update({ invoiceTotal: e.target.value })} /></Label></div>
            <Label>Receive into (optional)<Select value={draft.location} onChange={(e) => update({ location: e.target.value })}><option value="">Default location</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select></Label>
            <div className="space-y-3"><div className="flex items-center justify-between"><h4 className="font-semibold text-sm">Invoice line items</h4><Btn size="sm" variant="outline" onClick={() => update({ lines: [...draft.lines, emptyLine()] })}>Add line</Btn></div>
              {draft.lines.map((line, i) => <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-3"><div className="flex justify-between gap-2"><p className="text-xs font-bold uppercase text-gray-500">Line {i + 1}</p><button className="text-xs text-red-600" onClick={() => update({ lines: draft.lines.filter((_, j) => i !== j) })} disabled={draft.lines.length === 1}>Remove</button></div>
                <Label>Existing product (optional)<Select value={line.product_id} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, product_id: e.target.value } : l) })}><option value="">Create product from description below…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</Select></Label>
                <Label>{line.product_id ? 'Bill description (for reference)' : 'New product name (required if no existing product selected)'}<Input maxLength={120} value={line.description} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, description: e.target.value } : l) })} /></Label>
                {!line.product_id && <Label help="Choose an existing category name or type a new one. A missing category is created only after you approve the invoice.">Product category<Input list={`invoice-category-options-${i}`} maxLength={100} value={line.categoryName} onChange={(e) => update({ lines: draft.lines.map((l,j) => i === j ? { ...l, categoryName: e.target.value } : l) })} /><datalist id={`invoice-category-options-${i}`}>{categories.map((c) => <option key={c.id} value={c.label} />)}</datalist></Label>}
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
