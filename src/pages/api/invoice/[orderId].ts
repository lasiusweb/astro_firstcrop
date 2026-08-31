import type { APIRoute } from 'astro';
import { createServerClient } from '../../../lib/supabase/server';
import { escapeHtml } from '../../../lib/html';
import { getClaims } from '../../../lib/auth/get-claims';

export const GET: APIRoute = async (context) => {
  const { request, cookies, params } = context;
  const { orderId } = params;
  const claims = await getClaims(context);

  if (!claims) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createServerClient(cookies, { request });

  const { data: order, error } = await supabase
    .from('orders')
    .select(`
      *,
      items:order_items (*)
    `)
    .eq('id', orderId)
    .eq('user_id', claims.userId)
    .single();

  if (error || !order) {
    return new Response('Order not found', { status: 404 });
  }

  // Generate GST invoice HTML
  const invoiceHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice #${order.id.slice(0, 8).toUpperCase()}</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; color: #333; margin: 20px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #16A34A; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { font-size: 18px; color: #16A34A; margin: 0; }
        .header .invoice-no { font-size: 14px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #F0FDF4; font-weight: bold; }
        .text-right { text-align: right; }
        .totals { width: 300px; margin-left: auto; }
        .totals td { border: none; padding: 4px 8px; }
        .totals .total-row td { border-top: 2px solid #333; font-weight: bold; font-size: 14px; }
        .footer { margin-top: 30px; font-size: 10px; color: #666; text-align: center; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Firstcrop</h1>
          <p>Clean Agritech Pvt. Ltd.<br/>GSTIN: XXAAAA0000A1Z5<br/>Tamil Nadu, India</p>
        </div>
        <div class="text-right">
          <div class="invoice-no">TAX INVOICE</div>
          <p>Invoice #: ${order.id.slice(0, 8).toUpperCase()}<br/>Date: ${new Date(order.created_at).toLocaleDateString('en-IN')}</p>
        </div>
      </div>
      <div style="display: flex; gap: 40px; margin-bottom: 20px;">
        <div>
          <strong>Bill To:</strong><br/>
          ${escapeHtml(order.address_name)}<br/>
          ${escapeHtml(order.address_line1)}<br/>
          ${order.address_line2 ? escapeHtml(order.address_line2) + '<br/>' : ''}
          ${escapeHtml(order.address_city)}, ${escapeHtml(order.address_state)} - ${escapeHtml(order.address_pincode)}<br/>
          Phone: ${escapeHtml(order.address_phone)}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Product</th>
            <th>HSN</th>
            <th>Qty</th>
            <th class="text-right">Rate</th>
            <th class="text-right">GST%</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${order.items?.map((item: any, i: number) => `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(item.product_name)}</td>
              <td>${item.hsn_code}</td>
              <td>${item.quantity}</td>
              <td class="text-right">₹${item.unit_price.toFixed(2)}</td>
              <td class="text-right">${item.gst_rate}%</td>
              <td class="text-right">₹${item.line_total.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <table class="totals">
        <tr><td>Subtotal</td><td class="text-right">₹${order.subtotal.toFixed(2)}</td></tr>
        <tr><td>GST (${order.gst_type})</td><td class="text-right">₹${order.gst_total.toFixed(2)}</td></tr>
        <tr><td>Shipping</td><td class="text-right">${order.shipping === 0 ? 'FREE' : '₹' + order.shipping.toFixed(2)}</td></tr>
        <tr class="total-row"><td>Total</td><td class="text-right">₹${order.total.toFixed(2)}</td></tr>
      </table>
      <div class="footer">
        <p>Thank you for your purchase! For support, contact support@firstcrop.in</p>
      </div>
    </body>
    </html>
  `;

  return new Response(invoiceHtml, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': `inline; filename="invoice-${order.id.slice(0, 8)}.html"`,
    },
  });
};
