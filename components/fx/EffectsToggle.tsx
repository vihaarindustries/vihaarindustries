'use client';
import { useEffect, useState } from 'react';

/** Footer switch: visitors can turn the 3D background off (or back on). Remembered on this device. */
export default function EffectsToggle() {
  const [on, setOn] = useState(true); const [slow, setSlow] = useState(false);
  useEffect(() => {
    const read = () => { try { setOn(localStorage.getItem('vi-fx') !== 'off'); setSlow(sessionStorage.getItem('vi-fx-tier') === '3'); } catch { /* storage blocked */ } };
    read(); window.addEventListener('vi-fx-auto-off', read); window.addEventListener('vi-fx-change', read);
    return () => { window.removeEventListener('vi-fx-auto-off', read); window.removeEventListener('vi-fx-change', read); };
  }, []);
  const toggle = () => {
    const next = !on; setOn(next);
    try { localStorage.setItem('vi-fx', next ? 'on' : 'off'); if (next) sessionStorage.removeItem('vi-fx-tier'); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event('vi-fx-change'));
  };
  return <button type="button" onClick={toggle} aria-pressed={on} className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-gray-300 hover:text-white hover:border-white/40">
    <span className={`inline-block w-2 h-2 rounded-full ${on && !slow ? 'bg-[#29ca78]' : 'bg-gray-500'}`} aria-hidden="true" />
    3D effects: {on ? (slow ? 'paused (slow device)' : 'On') : 'Off'}
  </button>;
}
