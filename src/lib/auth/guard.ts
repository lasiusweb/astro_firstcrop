import type { APIContext } from 'astro';

export function requireAuth(context: APIContext): Response | undefined {
  if (!context.locals.claims) {
    return context.redirect('/auth/login', 302);
  }
}

export function requireAdmin(context: APIContext): Response | undefined {
  const redirect = requireAuth(context);
  if (redirect) return redirect;
  if (context.locals.claims?.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }
}

/**
 * Page guards — for use at the top of .astro frontmatter (top-level return).
 * Use requireAuth/requireAdmin in API endpoints instead (403 for non-admins).
 */
export function redirectIfGuest(context: APIContext): Response | undefined {
  if (!context.locals.claims) {
    return context.redirect('/auth/login');
  }
}

export function redirectIfNotAdmin(context: APIContext): Response | undefined {
  if (context.locals.claims?.role !== 'admin') {
    return context.redirect('/auth/login');
  }
}
