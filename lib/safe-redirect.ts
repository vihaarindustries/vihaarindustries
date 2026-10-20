/** Only allow same-site relative redirects (blocks open-redirect tricks such as //evil.com). */
export function safeNext(value: string | null | undefined, fallback = '/account') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\') || /[\r\n]/.test(value)) return fallback;
  return value;
}
