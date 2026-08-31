import type { APIRoute } from 'astro';
import { createServerClient } from '../../../../lib/supabase/server';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, cookies }) => {
  const slug = params.slug;
  if (!slug) return new Response('Bad request', { status: 400 });

  const supabase = createServerClient(cookies, { request });
  const { data: product } = await supabase.from('products').select('id').eq('slug', slug).single();
  if (!product) return new Response('Not found', { status: 404 });

  const { data: reviews } = await supabase
    .from('product_reviews')
    .select('rating, title, body, created_at, user_id')
    .eq('product_id', product.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return new Response(JSON.stringify({ reviews: reviews ?? [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

export const POST: APIRoute = async ({ params, request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims) {
    return new Response(JSON.stringify({ error: 'Login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const slug = params.slug;
  if (!slug) return new Response('Bad request', { status: 400 });

  const body = await request.json();
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return new Response(JSON.stringify({ error: 'Rating must be 1–5' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const title = typeof body?.title === 'string' ? body.title.slice(0, 120) : null;
  const text = typeof body?.body === 'string' ? body.body.slice(0, 2000) : null;
  if (!title && !text) {
    return new Response(JSON.stringify({ error: 'Write a short review' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });
  const { data: product } = await supabase.from('products').select('id').eq('slug', slug).single();
  if (!product) return new Response('Not found', { status: 404 });

  // Upsert: one review per user per product (re-review replaces)
  const { error } = await supabase.from('product_reviews').upsert(
    { product_id: product.id, user_id: claims.userId, rating, title, body: text },
    { onConflict: 'product_id,user_id' }
  );

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};