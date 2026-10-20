import OrderDetail from '@/components/admin/views/OrderDetail';
export default async function Page({ params }: { params: Promise<{ id: string }> | { id: string } }) { return <OrderDetail id={(await params).id} />; }
