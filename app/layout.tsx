import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Vihaar Industries | Dehydrated Spices & Ingredients', description: 'Quality-focused onion powder, garlic powder and dehydrated spice ingredients for retail, food service and industry.', metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
