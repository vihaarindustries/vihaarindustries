import Link from 'next/link';
export default function NotFound() {
  return <main className="container py-24 text-center"><div className="eyebrow">404</div><h1 className="text-4xl font-black mt-3">Page not found</h1><p className="muted mt-3">The page you are looking for does not exist.</p><Link href="/" className="btn mt-7">Back to home</Link></main>;
}
