import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { getClaims } from '../../../lib/auth/get-claims';

export const GET: APIRoute = async (context) => {
  const { request, cookies } = context;
  const claims = await getClaims(context);

  if (!claims) {
    return new Response(JSON.stringify({ items: [], total: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id,
      quantity,
      product:products (
        id,
        name,
        slug,
        price,
        compare_price,
        images
      )
    `)
    .eq('user_id', claims.userId);

  if (error) {
    console.error('[Cart] Get error:', error.message);
    return new Response(JSON.stringify({ items: [], total: 0, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const items = (data || []).map((item: any) => ({
    id: item.id,
    quantity: item.quantity,
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      price: item.product.price,
      comparePrice: item.product.compare_price,
      image: item.product.images?.[0] || '',
    },
  }));

  const total = items.reduce((sum: number, item: any) => sum + item.product.price * item.quantity, 0);

  return new Response(JSON.stringify({ items, total }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
