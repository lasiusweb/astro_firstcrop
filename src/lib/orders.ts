import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order } from './database.types';

export type OrderStatus = Order['status'];

/** Guarded status machine per AGENTS.md. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['shipped', 'refunded'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Attempts a guarded status transition, records history.
 * Returns { ok: false, error } instead of throwing on invalid transitions.
 */
export async function transitionOrder(
  supabase: SupabaseClient,
  orderId: string,
  to: OrderStatus,
  options: { changedBy?: string; note?: string } = {}
): Promise<{ ok: boolean; error?: string }> {
  const { data: order, error: fetchError } = await supabase
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single();

  if (fetchError || !order) return { ok: false, error: 'Order not found' };

  const from = order.status as OrderStatus;
  if (from === to) return { ok: true };
  if (!canTransition(from, to)) {
    return { ok: false, error: `Invalid transition: ${from} → ${to}` };
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status: to, payment_status: to === 'paid' ? 'paid' : undefined, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', from); // conditional update — guards against concurrent transitions

  if (updateError) return { ok: false, error: updateError.message };

  await supabase.from('order_status_history').insert({
    order_id: orderId,
    from_status: from,
    to_status: to,
    changed_by: options.changedBy ?? null,
    note: options.note ?? null,
  });

  return { ok: true };
}

/** Splits GST for Indian intra/inter-state sales. Seller is registered in Tamil Nadu. */
export const SELLER_STATE = 'Tamil Nadu';

export function splitGst(state: string, gstTotal: number): {
  gstType: 'IGST' | 'CGST_SGST';
  igst: number; cgst: number; sgst: number;
} {
  const intra = state?.trim().toLowerCase() === SELLER_STATE.toLowerCase();
  if (intra) {
    const half = Math.round((gstTotal / 2) * 100) / 100;
    return { gstType: 'CGST_SGST', igst: 0, cgst: half, sgst: Math.round((gstTotal - half) * 100) / 100 };
  }
  return { gstType: 'IGST', igst: gstTotal, cgst: 0, sgst: 0 };
}