-- 002: schema fixes — align orders with checkout code, add missing tables + RLS

-- Add flat address columns + GST split used by checkout code & invoice
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS address_name TEXT,
  ADD COLUMN IF NOT EXISTS address_phone TEXT,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS address_city TEXT,
  ADD COLUMN IF NOT EXISTS address_state TEXT,
  ADD COLUMN IF NOT EXISTS address_pincode TEXT,
  ADD COLUMN IF NOT EXISTS address_country TEXT DEFAULT 'India',
  ADD COLUMN IF NOT EXISTS gst_type TEXT CHECK (gst_type IN ('IGST','CGST_SGST')),
  ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(10,2);

-- Idempotency key must be insertable without value when client doesn't send one
ALTER TABLE orders ALTER COLUMN idempotency_key DROP NOT NULL;

-- Cart items (referenced by all cart APIs but never defined in 001)
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items(user_id);

-- Order items (referenced by checkout + invoice)
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  gst_rate NUMERIC(4,2) NOT NULL DEFAULT 18.00,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  hsn_code TEXT NOT NULL DEFAULT '3105',
  line_total NUMERIC(10,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY cart_own ON cart_items FOR ALL USING (user_id = auth.uid());
CREATE POLICY order_items_read ON order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
CREATE POLICY osh_read ON order_status_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_id AND o.user_id = auth.uid()));
-- webhook_logs / audit_log: service-role only (no policy = deny for anon/authenticated)

-- Public catalog reads (anon-friendly)
CREATE POLICY categories_read ON categories FOR SELECT USING (true);
-- Public product read already exists in 001 (status='active'); make it explicit for anon:
DROP POLICY IF EXISTS products_read ON products;
CREATE POLICY products_read ON products FOR SELECT
  USING (status = 'active' OR auth.jwt() ->> 'role' = 'admin');

-- Atomic stock decrement; raises INSUFFICIENT_STOCK when not enough quantity
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE products
  SET stock_qty = stock_qty - p_qty, updated_at = now()
  WHERE id = p_product_id AND stock_qty >= p_qty;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;
END;
$$;