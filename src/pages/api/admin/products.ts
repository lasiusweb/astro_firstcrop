import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase/admin';
import { createServerClient } from '../../../lib/supabase/server';
import { logAudit } from '../../../lib/audit';
import { purgeCache } from '../../../../integrations/cache-netlify.mjs';

const denied = () =>
  new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export const GET: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims || claims.role !== 'admin') return denied();

  const supabase = createServerClient(cookies, { request });
  const { data, error } = await supabase
    .from('products')
    .select('id, name, slug, price, stock_qty, status, images, category:categories(name)')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ products: [], error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const products = (data || []).map((p: any) => ({
    ...p,
    category_name: p.category?.name || null,
  }));

  return new Response(JSON.stringify({ products }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Create a product. Body: { name, price, category_id, stock_qty, ... } */
export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims || claims.role !== 'admin') return denied();

  const body = await request.json();
  if (!body?.name || body?.price == null) {
    return new Response(JSON.stringify({ error: 'name and price required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('products')
    .insert({
      name: body.name,
      slug: body.slug || slugify(body.name),
      price: body.price,
      compare_price: body.compare_price ?? null,
      stock_qty: body.stock_qty ?? 0,
      category_id: body.category_id ?? null,
      short_desc: body.short_desc ?? null,
      description: body.description ?? null,
      status: body.status ?? 'draft',
    })
    .select('id, slug')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await logAudit(admin, {
    actorId: claims.userId,
    action: 'product.create',
    entity: 'products',
    entityId: data.id,
    after: body,
  });
  await purgeCache({ tags: ['products'] });

  return new Response(JSON.stringify({ success: true, product: data }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Update a product. Body: { id, ...fields }; status=archived supported. */
export const PATCH: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims || claims.role !== 'admin') return denied();

  const body = await request.json();
  if (!body?.id) {
    return new Response(JSON.stringify({ error: 'id required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id, ...updates } = body;
  const allowed = ['name', 'slug', 'price', 'compare_price', 'stock_qty', 'category_id', 'short_desc', 'description', 'status'];
  const patch = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));

  if (Object.keys(patch).length === 0) {
    return new Response(JSON.stringify({ error: 'No valid fields to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createAdminClient();
  const { data: before } = await admin.from('products').select('*').eq('id', id).single();
  const { error } = await admin
    .from('products')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await logAudit(admin, {
    actorId: claims.userId,
    action: 'product.update',
    entity: 'products',
    entityId: id,
    before: before ?? undefined,
    after: patch,
  });
  await purgeCache({ tags: ['products'] });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
