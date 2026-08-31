import type { APIRoute } from 'astro';
import { createServerClient } from '../../lib/supabase/server';

const denied = () =>
  new Response(JSON.stringify({ error: 'Login required' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims) return denied();

  const supabase = createServerClient(cookies, { request });
  const { data, error } = await supabase
    .from('wishlist')
    .select('id, product_id, products (id, name, slug, price, compare_price, images, short_desc)')
    .eq('user_id', claims.userId)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ items: data ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims) return denied();

  const { productId } = await request.json();
  if (!productId) {
    return new Response(JSON.stringify({ error: 'productId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { error } = await supabase
    .from('wishlist')
    .upsert({ user_id: claims.userId, product_id: productId }, { onConflict: 'user_id,product_id' });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const DELETE: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims) return denied();

  const { productId } = await request.json();
  if (!productId) {
    return new Response(JSON.stringify({ error: 'productId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { error } = await supabase
    .from('wishlist')
    .delete()
    .eq('user_id', claims.userId)
    .eq('product_id', productId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};