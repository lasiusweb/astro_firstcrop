import type { APIRoute } from 'astro';
import { createServerClient } from '../../lib/supabase/server';

export const GET: APIRoute = async ({ url, cookies, request }) => {
  const query = url.searchParams.get('q')?.trim();

  if (!query || query.length < 2) {
    return new Response(JSON.stringify({ results: [] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (query.length > 100) {
    return new Response(JSON.stringify({ error: 'Query too long' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createServerClient(cookies, { request });

  // Full-text search across name + short_desc + description
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, price, compare_price, images, short_desc')
    .eq('status', 'active')
    .or(`name.ilike.%${query}%,short_desc.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(12);

  if (error) {
    console.error('[Search] Error:', error.message);
    return new Response(JSON.stringify({ results: [], error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const results = (data || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    comparePrice: p.compare_price,
    image: p.images?.[0] || '',
    shortDesc: p.short_desc,
  }));

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
