/**
 * Turns a template (plain text with {{placeholders}}) into a branded HTML email plus a plain-text copy.
 * Pure functions, no server-only imports: the control room preview and the real send use exactly this code.
 *
 * Writing rules for the person editing a template:
 *   - a blank line starts a new paragraph
 *   - lines that start with "- " become a bullet list
 *   - **text** becomes bold
 *   - a line whose placeholders are ALL empty (e.g. "Tracking ID: {{tracking_id}}" with no tracking ID) is left out
 *   - web addresses (https://...) become clickable links
 * Everything typed in a template or filled into a placeholder is HTML-escaped, so nobody can inject markup into an email.
 */
const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Names used as {{placeholders}} in `text` that are not in `allowed` (used to stop typos being saved). */
export function unknownPlaceholders(text: string, allowed: string[]): string[] {
  const ok = new Set(allowed.map((a) => a.toLowerCase()));
  const bad = new Set<string>();
  for (const m of text.matchAll(PLACEHOLDER)) if (!ok.has(m[1].toLowerCase())) bad.add(m[1]);
  return [...bad];
}
/** True when text has a stray "{{" or "}}" that is not a complete {{name}} placeholder (a common typo). */
export const hasBrokenBraces = (text: string) => /\{\{|\}\}/.test(text.replace(PLACEHOLDER, ''));

function fillLine(line: string, vars: Record<string, string>): string | null {
  let had = 0; let filled = 0;
  const out = line.replace(PLACEHOLDER, (_m, k: string) => {
    had++;
    const v = vars[k.toLowerCase()];
    if (v !== undefined && v !== '') { filled++; return v; }
    return '';
  });
  if (had > 0 && filled === 0) return null;   // every placeholder on this line was empty: drop the whole line
  return out.replace(/[ \t]{2,}/g, ' ').trimEnd();
}

/** Subject line: placeholders filled, never spans lines. */
export function renderSubject(subject: string, vars: Record<string, string>) {
  return subject.replace(PLACEHOLDER, (_m, k: string) => vars[k.toLowerCase()] ?? '').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 200);
}

type Block = { kind: 'p' | 'ul'; lines: string[] };
function toBlocks(body: string, vars: Record<string, string>): Block[] {
  const out: Block[] = [];
  for (const raw of body.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    // a placeholder value may itself hold several lines (the item list); keep them together inside this paragraph
    const lines = raw.split('\n').map((l) => fillLine(l, vars)).filter((l): l is string => l !== null && l.trim() !== '');
    if (!lines.length) continue;
    const bullets = lines.every((l) => /^\s*[-•]\s+/.test(l));
    out.push(bullets ? { kind: 'ul', lines: lines.map((l) => l.replace(/^\s*[-•]\s+/, '')) } : { kind: 'p', lines });
  }
  return out;
}

function inline(escaped: string) {
  return escaped
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/https?:\/\/[^\s<>"']+/g, (u) => {
      const m = u.match(/[.,;:!?)]+$/); const tail = m ? m[0] : ''; const url = tail ? u.slice(0, -tail.length) : u;
      return `<a href="${url}" style="color:#00994d;word-break:break-all">${url}</a>${tail}`;
    });
}
const safeUrl = (u?: string) => (u && /^https?:\/\/[^\s<>"']+$/i.test(u) ? u : '');

export type RenderArgs = {
  subject: string; body: string; buttonLabel?: string | null; buttonUrl?: string;
  vars: Record<string, string>; brandName: string; footerLines?: string[];
};
export type Rendered = { subject: string; html: string; text: string };

export function renderEmail(a: RenderArgs): Rendered {
  const subject = renderSubject(a.subject, a.vars);
  const blocks = toBlocks(a.body, a.vars);
  const url = safeUrl(a.buttonUrl); const label = (a.buttonLabel ?? '').trim();
  const hasButton = !!url && !!label;
  const footer = (a.footerLines ?? []).filter(Boolean);

  const body = blocks.map((b) => b.kind === 'ul'
    ? `<ul style="margin:0 0 16px;padding-left:20px">${b.lines.map((l) => `<li style="margin:0 0 4px">${inline(escapeHtml(l))}</li>`).join('')}</ul>`
    : `<p style="margin:0 0 16px">${b.lines.map((l) => inline(escapeHtml(l))).join('<br>')}</p>`).join('');
  const button = hasButton
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px"><tr><td style="background:#00994d;border-radius:6px"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none">${escapeHtml(label)}</a></td></tr></table>` +
      `<p style="margin:0 0 8px;font-size:12px;color:#6b7280">If the button does not work, copy and paste this link into your browser:<br><a href="${escapeHtml(url)}" style="color:#00994d;word-break:break-all">${escapeHtml(url)}</a></p>`
    : '';
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden">` +
    `<tr><td style="background:#00994d;padding:18px 28px;color:#ffffff;font-size:20px;font-weight:700">${escapeHtml(a.brandName)}</td></tr>` +
    `<tr><td style="padding:28px;font-size:15px;line-height:1.6">${body}${button}</td></tr>` +
    `<tr><td style="padding:16px 28px 24px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.5;color:#6b7280">${escapeHtml(a.brandName)}${footer.map((f) => `<br>${escapeHtml(f)}`).join('')}<br>This is an automated message about your account or order.</td></tr>` +
    `</table></td></tr></table></body></html>`;

  const text = [
    ...blocks.map((b) => (b.kind === 'ul' ? b.lines.map((l) => `- ${l}`).join('\n') : b.lines.join('\n')).replace(/\*\*([^*\n]+)\*\*/g, '$1')),
    ...(hasButton ? [`${label}: ${url}`] : []),
    ['--', a.brandName, ...footer].join('\n'),
  ].join('\n\n');
  return { subject, html, text };
}
