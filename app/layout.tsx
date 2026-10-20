import type { Metadata } from 'next';
import './globals.css';
import TrackVisit from '@/components/TrackVisit';
import ChatbotWidget, { type ChatConfig } from '@/components/ChatbotWidget';
import { getSetting } from '@/lib/site';
export const metadata: Metadata = { title: 'Vihaar Industries | Dehydrated Spices & Ingredients', description: 'Quality-focused onion powder, garlic powder and dehydrated spice ingredients for retail, food service and industry.', metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const chat = await getSetting<ChatConfig>('chatbot_config', { enabled: false });
  return <html lang="en"><body>{children}<TrackVisit /><ChatbotWidget config={{ enabled: chat.enabled, name: chat.name, greeting: chat.greeting, suggestions: chat.suggestions }} /></body></html>;
}
