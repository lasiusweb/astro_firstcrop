import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from './lib/supabase/server';
import type { Claims } from './lib/auth/get-claims';

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.claims = null;

  if (SUPABASE_URL?.startsWith('http')) {
    try {
      // Middleware is the only place allowed to write auth cookies,
      // so token refresh happens here on every request.
      const supabase = createServerClient(context.cookies, {
        allowCookieSet: true,
        request: context.request,
      });
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const claims: Claims = {
          userId: user.id,
          role: (user.app_metadata?.role as 'customer' | 'admin') || 'customer',
          phone: user.phone || '',
        };
        context.locals.claims = claims;
      }
    } catch {
      context.locals.claims = null;
    }
  }

  return next();
});
