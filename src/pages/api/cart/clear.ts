import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { getClaims } from '../../../lib/auth/get-claims';

export const DELETE: APIRoute = async (context) => {
  const { request, cookies } = context;
  const claims = await getClaims(context);
  if (!claims) {
    return new Response(JSON.stringify({ error: 'Login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('user_id', claims.userId);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
