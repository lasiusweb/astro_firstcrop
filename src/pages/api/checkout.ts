import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { createServerClient } from '../../lib/supabase/server';
import { transitionOrder, splitGst } from '../../lib/orders';
import { generatePayload } from '../../lib/payment/easebuzz';

export const POST: APIRoute = async ({ request, cookies, locals }) => {
  const claims = locals.claims;

  if (!claims) {
    return new Response(JSON.stringify({ error: 'Login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { address } = await request.json();

  if (!address?.name || !address?.phone || !address?.line1 || !address?.city || !address?.state || !address?.pincode) {
    return new Response(JSON.stringify({ error: 'Complete address required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Idempotency: client-supplied key wins; server generates one otherwise
  const idempotencyKey = request.headers.get('Idempotency-Key') || crypto.randomUUID();

  const supabase = createServerClient(cookies, { request });

  // 1. Fetch cart items
  const { data: cartItems, error: cartError } = await supabase
    .from('cart_items')
    .select(`
      id,
      quantity,
      product:products (
        id,
        name,
        price,
        gst_rate,
        hsn_code
      )
    `)
    .eq('user_id', claims.userId);

  if (cartError || !cartItems || cartItems.length === 0) {
    return new Response(JSON.stringify({ error: 'Cart is empty' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Calculate totals with GST
  let subtotal = 0;
  let totalGst = 0;
  const orderItems = cartItems.map((item: any) => {
    const product = item.product;
    const lineTotal = product.price * item.quantity;
    const gstAmount = Math.round(lineTotal * (product.gst_rate || 18) / 100 * 100) / 100;
    subtotal += lineTotal;
    totalGst += gstAmount;
    return {
      product_id: product.id,
      product_name: product.name,
      quantity: item.quantity,
      unit_price: product.price,
      gst_rate: product.gst_rate || 18,
      gst_amount: gstAmount,
      hsn_code: product.hsn_code || '3105',
      line_total: lineTotal + gstAmount,
    };
  });

  const shipping = subtotal >= 500 ? 0 : 49;
  const total = subtotal + totalGst + shipping;

  // 3. Determine GST type (intra vs inter state) from delivery state
  const { gstType, igst: igstAmount, cgst: cgstAmount, sgst: sgstAmount } = splitGst(address.state, totalGst);

  // 4. Validate stock before creating the order
  for (const item of orderItems) {
    const { data: product, error: stockErr } = await supabase
      .from('products')
      .select('stock_qty')
      .eq('id', item.product_id)
      .single();
    if (stockErr || !product || Number(product.stock_qty) < item.quantity) {
      return new Response(JSON.stringify({ error: `Insufficient stock for ${item.product_name}` }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 5. Create order (idempotent via unique idempotency_key)
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: claims.userId,
      status: 'pending',
      idempotency_key: idempotencyKey,
      subtotal,
      gst_total: totalGst,
      shipping,
      total,
      gst_type: gstType,
      igst_amount: igstAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      address_name: address.name,
      address_phone: address.phone,
      address_line1: address.line1,
      address_line2: address.line2 || '',
      address_city: address.city,
      address_state: address.state,
      address_pincode: address.pincode,
      address_country: address.country || 'India',
    })
    .select('id')
    .single();

  if (orderError) {
    // Unique violation → same idempotency key already processed
    if (orderError.code === '23505') {
      const { data: existing } = await supabase
        .from('orders')
        .select('id, status')
        .eq('idempotency_key', idempotencyKey)
        .single();
      return new Response(JSON.stringify({
        success: true,
        duplicate: true,
        orderId: existing?.id,
        status: existing?.status,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error('[Checkout] Order create error:', orderError.message);
    return new Response(JSON.stringify({ error: 'Failed to create order' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 6. Create order items
  const orderItemRows = orderItems.map((item: any) => ({
    order_id: order.id,
    ...item,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemRows);
  if (itemsError) {
    console.error('[Checkout] Order items error:', itemsError.message);
    return new Response(JSON.stringify({ error: 'Failed to record order items' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 7. Atomically decrement stock — rolls the order back to cancelled on failure
  for (const item of orderItems) {
    const { error: decErr } = await supabase.rpc('decrement_stock', {
      p_product_id: item.product_id,
      p_qty: item.quantity,
    });
    if (decErr) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id);
      return new Response(JSON.stringify({ error: `Insufficient stock for ${item.product_name}` }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 8. Clear cart
  await supabase.from('cart_items').delete().eq('user_id', claims.userId);

  // 9. Payment: Easebuzz hosted checkout when configured; dev mock otherwise
  const easebuzzKey = import.meta.env.PUBLIC_EASEBUZZ_KEY;
  const easebuzzSalt = process.env.EASEBUZZ_SALT;

  if (easebuzzKey && !String(easebuzzKey).startsWith('your-') && easebuzzSalt && !String(easebuzzSalt).startsWith('your-')) {
    const txnid = `FC_${order.id.replace(/-/g, '').slice(0, 12)}_${Date.now()}`;
    await supabase.from('orders').update({ payment_method: 'easebuzz', payment_id: txnid }).eq('id', order.id);

    const { payload, hash } = generatePayload(
      order.id,
      total,
      { name: address.name, email: address.email || 'orders@firstcrop.in', phone: address.phone },
      { key: easebuzzKey, salt: easebuzzSalt }
    );

    const action = import.meta.env.PUBLIC_EASEBUZZ_MODE === 'live'
      ? `https://pay.easebuzz.in/${easebuzzKey}/`
      : `https://testpay.easebuzz.in/${easebuzzKey}/`;

    return new Response(JSON.stringify({
      success: true,
      orderId: order.id,
      payment: 'easebuzz',
      paymentAction: action,
      paymentPayload: { ...payload, txnid },
      paymentHash: hash,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dev fallback: auto-confirm (sandbox without credentials)
  const result = await transitionOrder(supabase, order.id, 'paid', {
    changedBy: claims.userId,
    note: 'Auto-confirmed (no payment provider configured)',
  });
  if (!result.ok) {
    console.error('[Checkout] Payment transition error:', result.error);
  }
  await supabase.from('orders').update({
    payment_method: 'easebuzz',
    payment_id: `mock_${Date.now()}`,
  }).eq('id', order.id);

  return new Response(JSON.stringify({
    success: true,
    orderId: order.id,
    payment: 'mock',
    redirect: `/checkout/success?order=${order.id}`,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
