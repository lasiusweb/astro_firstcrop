import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase/admin';
import { createServerClient } from '../../../lib/supabase/server';
import { transitionOrder, type OrderStatus } from '../../../lib/orders';
import { logAudit } from '../../../lib/audit';

const denied = () =>
  new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims || claims.role !== 'admin') return denied();

  const supabase = createServerClient(cookies, { request });
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total, address_name, address_phone, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ orders: [], error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ orders: data || [] }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/** Update order status (guarded transitions). Body: { orderId, status } */
export const PATCH: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;
  if (!claims || claims.role !== 'admin') return denied();

  const { orderId, status } = await request.json();
  if (!orderId || !status) {
    return new Response(JSON.stringify({ error: 'orderId and status required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const admin = createAdminClient();
  const result = await transitionOrder(admin, orderId, status as OrderStatus, {
    changedBy: claims.userId,
    note: 'Updated via admin dashboard',
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await logAudit(admin, {
    actorId: claims.userId,
    action: 'order.status',
    entity: 'orders',
    entityId: orderId,
    after: { status },
  });

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
