import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import CartView from '@/components/cart/CartView';

export const metadata = { title: 'Your cart' };
export default function CartPage() { return <><Header mode="retail" /><main className="container py-12 max-w-5xl"><CartView /></main><Footer mode="retail" /></>; }
