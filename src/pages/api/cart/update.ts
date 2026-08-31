import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { getClaims } from '../../../lib/auth/get-claims';

export const PUT: APIRoute = async (context) => {
  const { request, cookies } = context;
  const claims = await getClaims(context);
  if (!claims) {
    return new Response(JSON.stringify({ error: 'Login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { itemId, quantity } = body;

  if (!itemId || quantity < 0) {
    return new Response(JSON.stringify({ error: 'Invalid item or quantity' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });

  if (quantity === 0) {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', claims.userId);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, deleted: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', itemId)
    .eq('user_id', claims.userId)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true, item: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
