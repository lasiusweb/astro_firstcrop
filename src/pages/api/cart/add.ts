import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { getClaims } from '../../../lib/auth/get-claims';

export const POST: APIRoute = async (context) => {
  const { request, cookies } = context;
  const claims = await getClaims(context);

  if (!claims) {
    return new Response(JSON.stringify({ error: 'Login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { productId, quantity = 1 } = body;

  if (!productId || quantity < 1) {
    return new Response(JSON.stringify({ error: 'Invalid product or quantity' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });

  // Validate product exists, is active, and has stock; clamp quantity
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('id, name, stock_qty, status')
    .eq('id', productId)
    .eq('status', 'active')
    .single();

  if (productErr || !product) {
    return new Response(JSON.stringify({ error: 'Product not available' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, quantity')
    .eq('user_id', claims.userId)
    .eq('product_id', productId)
    .single();

  const existingQty = existing?.quantity ?? 0;
  const maxQty = Number(product.stock_qty);
  const requestedQty = existingQty + quantity;

  if (requestedQty > maxQty) {
    return new Response(JSON.stringify({ error: `Only ${maxQty} in stock` }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let result;
  if (existing) {
    result = await supabase
      .from('cart_items')
      .update({ quantity: existing.quantity + quantity })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('cart_items')
      .insert({ user_id: claims.userId, product_id: productId, quantity })
      .select()
      .single();
  }

  if (result.error) {
    console.error('[Cart] Add error:', result.error.message);
    return new Response(JSON.stringify({ error: result.error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true, item: result.data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
