import type { APIContext } from 'astro';

export function requireAuth(context: APIContext): void {
  if (!context.locals.claims) {
    throw context.redirect('/auth/login', 302);
  }
}

export function requireAdmin(context: APIContext): void {
  requireAuth(context);
  if (context.locals.claims?.role !== 'admin') {
    throw new Response('Forbidden', { status: 403 });
  }
}
