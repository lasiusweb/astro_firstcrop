import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase/admin';
import { verifySignature } from '../../../lib/payment/easebuzz';
import { transitionOrder } from '../../../lib/orders';
import { logAudit } from '../../../lib/audit';

/**
 * Easebuzz payment webhook.
 * Per AGENTS.md: verify salt+hash signature, reject unknown txnid,
 * log every hit to webhook_logs, only transition pending → paid.
 */
export const POST: APIRoute = async ({ request }) => {
  const admin = createAdminClient();
  const salt = process.env.EASEBUZZ_SALT;

  let params: Record<string, string> = {};
  try {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      params = await request.json();
    } else {
      const form = await request.formData();
      for (const [key, value] of form.entries()) params[key] = String(value);
    }
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const receivedHash = params.hash || '';
  const signatureValid = Boolean(salt) && verifySignature(params, salt!, receivedHash);

  // Log every callback attempt — capture the row id so later updates
  // target the primary key instead of fragile JSON-equality matching.
  const { data: logRow } = await admin
    .from('webhook_logs')
    .insert({
      provider: 'easebuzz',
      payload: params,
      signature_valid: signatureValid,
      processed: false,
    })
    .select('id')
    .single();
  const logId: string | undefined = logRow?.id;

  const markLog = (patch: Record<string, unknown>) => {
    if (!logId) return;
    void admin.from('webhook_logs').update(patch).eq('id', logId);
  };

  if (!signatureValid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const txnid = params.txnid;
  if (!txnid) {
    return new Response('Missing txnid', { status: 400 });
  }

  const { data: order } = await admin
    .from('orders')
    .select('id, status, total')
    .eq('payment_id', txnid)
    .single();

  if (!order) {
    markLog({ error: 'Unknown txnid' });
    return new Response('Unknown txnid', { status: 404 });
  }

  // Easebuzz status: success / failure / pending / userCancelled
  const payStatus = (params.status || '').toLowerCase();
  if (payStatus === 'success') {
    const result = await transitionOrder(admin, order.id, 'paid', {
      note: `Easebuzz callback (txnid ${txnid})`,
    });
    if (!result.ok) {
      console.error('[Webhook] Transition failed:', result.error);
      markLog({ error: `Transition failed: ${result.error}` });
    } else {
      markLog({ processed: true });
    }
  } else if (payStatus === 'failure' || payStatus === 'usercancelled') {
    await transitionOrder(admin, order.id, 'cancelled', {
      note: `Easebuzz ${payStatus} (txnid ${txnid})`,
    });
  }

  await logAudit(admin, {
    action: 'payment.webhook',
    entity: 'orders',
    entityId: order.id,
    after: { txnid, payStatus, signatureValid },
  });

  return new Response('OK', { status: 200 });
};