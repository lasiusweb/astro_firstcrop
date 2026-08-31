import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { phone, token } = await request.json();

  if (!phone || !token) {
    return new Response(JSON.stringify({ error: 'Phone and OTP required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { data, error } = await supabase.auth.verifyOtp({
    phone: `+91${phone}`,
    token,
    type: 'sms',
  });

  if (error || !data.session) {
    console.error('[Auth] Verify OTP error:', error?.message);
    return new Response(JSON.stringify({ error: 'Invalid or expired OTP' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Set session cookies via Supabase SSR
  const { access_token, refresh_token } = data.session;
  cookies.set('sb-access-token', access_token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });
  cookies.set('sb-refresh-token', refresh_token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });

  return new Response(JSON.stringify({ success: true, redirect: '/account' }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
