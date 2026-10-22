import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import CheckoutForm from '@/components/cart/CheckoutForm';

export const metadata = { title: 'Checkout' };
export default function CheckoutPage() { return <><Header mode="retail" /><main className="container py-12 max-w-5xl"><CheckoutForm /></main><Footer mode="retail" /></>; }
