'use client';
import { useEffect } from 'react';

/** Remembers which side of the site the visitor chose (retail or business) so shared pages show the right menu. */
export default function ModeSetter({ mode }: { mode: 'retail' | 'business' }) {
  useEffect(() => { try { document.cookie = `vi_mode=${mode}; path=/; max-age=${60 * 60 * 24 * 90}; samesite=lax`; } catch { /* cookies blocked */ } }, [mode]);
  return null;
}
