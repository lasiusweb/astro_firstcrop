import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { checkOtpRate, clientIp } from '../../../lib/ratelimit';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { phone } = await request.json();

  if (!phone || !/^[6-9]\d{9}$/.test(phone)) {
    return new Response(JSON.stringify({ error: 'Invalid phone number' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limit: 60s resend cooldown per phone, per-phone and per-IP quotas
  const rate = checkOtpRate(phone, clientIp(request.headers));
  if (!rate.allowed) {
    return new Response(
      JSON.stringify({ error: `Too many attempts. Retry in ${rate.retryAfterSeconds}s.` }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rate.retryAfterSeconds),
        },
      }
    );
  }

  const supabase = createServerClient(cookies, { request });
  const { error } = await supabase.auth.signInWithOtp({ phone: `+91${phone}` });

  if (error) {
    console.error('[Auth] Send OTP error:', error.message);
    return new Response(JSON.stringify({ error: 'Failed to send OTP. Try again.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
