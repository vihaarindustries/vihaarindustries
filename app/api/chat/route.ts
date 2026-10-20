import { NextResponse } from 'next/server';
import { createPublicClient } from '@/lib/supabase/public';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { sameOrigin } from '@/lib/admin/http';
import { createService } from '@/lib/supabase/service';
import { buildSystemPrompt, type ChatProduct } from '@/lib/chat/prompt';

export const dynamic = 'force-dynamic';
const reply = (b: object, status = 200) => NextResponse.json(b, { status, headers: { 'Cache-Control': 'no-store' } });
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';   // set GEMINI_MODEL to a current Gemini model name

export async function POST(req: Request) {
  if (!sameOrigin(req)) return reply({ error: 'Request blocked.' }, 403);
  const ip = clientIp(req);
  if (!rateLimit(`chat:${ip}`, 12, 60_000).ok || !rateLimit(`chat-h:${ip}`, 120, 3_600_000).ok) return reply({ error: 'You are sending messages very quickly. Please wait a moment.' }, 429);

  let body: { messages?: unknown };
  try { body = JSON.parse((await req.text()).slice(0, 12_000)); } catch { return reply({ error: 'Invalid request.' }, 400); }
  const raw = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
  const messages = raw
    .filter((m): m is { role: string; content: string } => !!m && typeof m === 'object' && typeof (m as { content?: unknown }).content === 'string' && ['user', 'assistant'].includes((m as { role?: string }).role ?? ''))
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content.slice(0, 800) }] }));
  if (!messages.length || messages[messages.length - 1].role !== 'user') return reply({ error: 'Please type a question.' }, 400);

  const pub = createPublicClient();
  if (!pub) return reply({ error: 'The assistant is not available right now.' }, 503);
  const { data: cfg } = await pub.from('site_settings').select('value').eq('key', 'chatbot_config').maybeSingle();
  const config = (cfg?.value ?? {}) as { enabled?: boolean };
  if (!config.enabled) return reply({ error: 'The assistant is switched off.' }, 503);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply({ error: 'The assistant is not connected yet. Please use the enquiry form and our team will reply.' }, 503);

  const { data: products } = await pub.from('products').select('name, short_description, unit, min_order_quantity, is_export_available').eq('is_active', true).order('sort_order').limit(40);
  const svc = createService();
  const { data: kb } = svc ? await svc.from('site_settings').select('value').eq('key', 'chatbot_knowledge').maybeSingle() : { data: null };
  const system = buildSystemPrompt((products ?? []) as ChatProduct[], String((kb?.value as { text?: string } | null)?.text ?? '').slice(0, 6000));

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] }, contents: messages,
        generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) { console.error('[chat] Gemini error', res.status); return reply({ error: 'The assistant is busy. Please try again in a moment.' }, 502); }
    const json = await res.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('').trim();
    return reply({ reply: text || 'Sorry, I could not answer that. Please use the Enquiry page and our team will help.' });
  } catch (e) {
    console.error('[chat] request failed', e instanceof Error ? e.name : 'error');
    return reply({ error: 'The assistant is busy. Please try again in a moment.' }, 502);
  }
}
