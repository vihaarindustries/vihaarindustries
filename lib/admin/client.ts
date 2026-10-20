'use client';

export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }

/** Calls the admin API. Sends JSON, throws ApiError with a readable message, and sends the user to sign in when the session ended. */
export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
      headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'same-origin', cache: 'no-store',
    });
  } catch { throw new ApiError('Network problem. Check your connection and try again.', 0); }
  if (res.status === 401) {
    const j = await res.json().catch(() => ({}));
    window.location.href = j?.mfa ? `/auth/mfa?next=${encodeURIComponent(window.location.pathname)}` : `/auth/sign-in?next=${encodeURIComponent(window.location.pathname)}`;
    throw new ApiError('Session ended.', 401);
  }
  const j = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(j?.error || 'Something went wrong.', res.status);
  return (j && 'data' in j ? j.data : j) as T;
}
export const rpc = <T = unknown>(name: string, args: Record<string, unknown> = {}) => api<T>(`/api/admin/rpc/${name}`, { method: 'POST', body: args });
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');
