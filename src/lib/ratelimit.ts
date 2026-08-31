/**
 * Simple in-memory rate limiter.
 * NOTE: In serverless (Netlify Functions) memory is per-instance — this is a
 * first-line throttle, not a hard guarantee. Supabase Auth also rate-limits OTP.
 */
const buckets = new Map<string, { count: number; resetAt: number; lastAt: number }>();

interface RateResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

function check(key: string, opts: { windowMs: number; max: number; cooldownMs?: number }): RateResult {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs, lastAt: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Per-action cooldown (e.g. 60s OTP resend)
  if (opts.cooldownMs && now - entry.lastAt < opts.cooldownMs) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((opts.cooldownMs - (now - entry.lastAt)) / 1000),
    };
  }

  if (entry.count >= opts.max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  entry.lastAt = now;
  return { allowed: true, retryAfterSeconds: 0 };
}

/** OTP: 1 send per phone per 60s cooldown, max 5 per phone per 15min. */
export function checkOtpRate(phone: string, ip: string): RateResult {
  const byPhone = check(`otp:phone:${phone}`, { windowMs: 15 * 60_000, max: 5, cooldownMs: 60_000 });
  if (!byPhone.allowed) return byPhone;
  return check(`otp:ip:${ip}`, { windowMs: 15 * 60_000, max: 20 });
}

function clientIp(headers: Headers): string {
  return (
    headers.get('x-nf-client-connection-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export { clientIp };

// Periodic cleanup to avoid unbounded growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of buckets) {
    if (now >= entry.resetAt) buckets.delete(key);
  }
}, 60_000).unref?.();