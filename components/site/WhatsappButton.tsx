'use client';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

/** Floating WhatsApp chat button. The link is built on the server from the business contact number. */
export default function WhatsAppButton({ href, label }: { href: string | null; label: string }) {
  const path = usePathname();
  if (!href || path.startsWith('/control-room') || path.startsWith('/auth')) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label}
    className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-[#25D366] text-white pl-4 pr-5 py-3 shadow-xl hover:brightness-95 transition text-sm font-bold print:hidden">
    <MessageCircle size={20} /><span className="hidden sm:inline">Chat on WhatsApp</span></a>;
}
