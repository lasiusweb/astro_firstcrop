import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { getClaims } from '../../../lib/auth/get-claims';

export const GET: APIRoute = async (context) => {
  const { request, cookies } = context;
  const claims = await getClaims(context);
  if (!claims || claims.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });

  const [ordersRes, productsRes, customersRes] = await Promise.all([
    supabase.from('orders').select('id, total, status, address_name, created_at').order('created_at', { ascending: false }).limit(10),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('orders').select('user_id', { count: 'exact', head: true }),
  ]);

  const orders = ordersRes.data || [];
  const totalOrders = orders.length;
  const revenue = orders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  return new Response(JSON.stringify({
    totalOrders,
    revenue,
    activeProducts: productsRes.count ?? 0,
    customers: customersRes.count ?? 0,
    recentOrders: orders.slice(0, 5),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
