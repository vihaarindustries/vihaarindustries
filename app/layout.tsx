import type { Metadata } from 'next';
import './globals.css';
import TrackVisit from '@/components/TrackVisit';
import ChatbotWidget, { type ChatConfig } from '@/components/ChatbotWidget';
import WhatsAppButton from '@/components/site/WhatsAppButton';
import { CartProvider } from '@/components/cart/CartProvider';
import { getBusiness, getSetting } from '@/lib/site';
import { whatsappLink } from '@/lib/business';

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBusiness();
  return {
    title: `${b.name} | Dehydrated Spices & Ingredients`,
    description: 'Quality-focused onion powder, garlic powder and dehydrated spice ingredients for retail, food service and industry.',
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
    // the logo uploaded in the control room also becomes the browser-tab icon
    icons: b.logoUrl ? { icon: b.logoUrl, apple: b.logoUrl } : undefined,
  };
}
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [chat, b] = await Promise.all([getSetting<ChatConfig>('chatbot_config', { enabled: false }), getBusiness()]);
  return <html lang="en"><body><CartProvider>{children}</CartProvider><TrackVisit /><WhatsAppButton href={whatsappLink(b)} label={`Chat with ${b.name} on WhatsApp`} /><ChatbotWidget config={{ enabled: chat.enabled, name: chat.name, greeting: chat.greeting, suggestions: chat.suggestions }} /></body></html>;
}
