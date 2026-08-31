import type { APIContext } from 'astro';

export interface Claims {
  userId: string;
  role: 'customer' | 'admin';
  phone: string;
}

/**
 * Reads claims from `locals`, which middleware populates on every request.
 * Accepts an APIContext (pages: `getClaims(Astro)`).
 * Do NOT call this with cookies — middleware already validated the session,
 * so calling sites avoid a duplicate Supabase Auth round-trip.
 */
export async function getClaims(context: APIContext): Promise<Claims | null> {
  return context.locals.claims;
}
