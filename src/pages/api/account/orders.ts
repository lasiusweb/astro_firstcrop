import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { getClaims } from '../../../lib/auth/get-claims';

export const GET: APIRoute = async (context) => {
  const { request, cookies } = context;
  const claims = await getClaims(context);
  if (!claims) {
    return new Response(JSON.stringify({ orders: [] }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      status,
      total,
      created_at,
      items:order_items (product_name, quantity)
    `)
    .eq('user_id', claims.userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('[Orders] Error:', error.message);
    return new Response(JSON.stringify({ orders: [], error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ orders: data || [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
