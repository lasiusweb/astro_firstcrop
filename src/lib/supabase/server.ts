import { createServerClient as createSupabaseSSRClient, parseCookieHeader } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import type { Database } from '../database.types';

interface ServerClientOptions {
  /**
   * Astro only allows cookie writes from middleware and API endpoints.
   * Pages get a read-only client (refresh cookies are handled by middleware).
   */
  allowCookieSet?: boolean;
  /** Raw request — required to read the cookie header for getAll(). */
  request?: Request;
}

export function createServerClient(
  cookies: AstroCookies,
  options: ServerClientOptions = {}
) {
  return createSupabaseSSRClient<Database>(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: 'pkce',
      },
      cookies: {
        getAll() {
          const header = options.request?.headers.get('cookie') ?? '';
          return parseCookieHeader(header);
        },
        setAll(cookiesToSet) {
          if (!options.allowCookieSet) return;
          for (const { name, value, options: cookieOptions } of cookiesToSet) {
            cookies.set(name, value, {
              path: '/',
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              ...cookieOptions,
            });
          }
        },
      },
    }
  );
}
