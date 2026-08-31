import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createServerClient(cookies, { request });
  await supabase.auth.signOut();

  cookies.delete('sb-access-token', { path: '/' });
  cookies.delete('sb-refresh-token', { path: '/' });

  return new Response(JSON.stringify({ success: true, redirect: '/' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
