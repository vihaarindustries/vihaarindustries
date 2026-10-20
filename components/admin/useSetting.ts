'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '@/lib/admin/client';

/** Loads one site setting and saves it back through the validated settings API. */
export function useSetting<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    api<{ value: T }>(`/api/admin/settings/${key}`).then((r) => { if (live) setValue({ ...fallback, ...(r?.value ?? {}) }); }).catch((e) => live && setError(errMsg(e))).finally(() => live && setLoading(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = useCallback(async (v: T) => { const out = await api<T>(`/api/admin/settings/${key}`, { method: 'PUT', body: { value: v } }); setValue(out); return out; }, [key]);
  return { value, setValue, loading, error, save };
}
