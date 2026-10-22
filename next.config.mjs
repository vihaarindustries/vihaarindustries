const isProd = process.env.NODE_ENV === 'production';
let supabaseOrigin = '';
try { supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin; } catch { /* not configured yet */ }

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://*.supabase.co https://cdnjs.cloudflare.com https://cdn.jsdelivr.net ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com ${supabaseOrigin}`.trim(),
  "worker-src 'self' blob: https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com",
  "frame-src 'self' blob:",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const security = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  ...(isProd ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false, reactStrictMode: true,
  async headers() {
    return [
      { source: '/:path*', headers: security },
      { source: '/control-room/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }, { key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default nextConfig;
