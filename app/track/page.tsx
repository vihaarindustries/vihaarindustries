import Header from '@/components/Header';
import Footer from '@/components/site/Footer';
import TrackForm from '@/components/site/TrackForm';

export const metadata = { title: 'Track your order' };
export default function TrackPage() { return <><Header /><main><TrackForm /></main><Footer /></>; }
