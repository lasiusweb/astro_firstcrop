/**
 * Hand-written database types matching supabase/migrations.
 * Regenerate with `npx supabase gen types typescript` when the schema changes.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_desc: string | null;
  price: number;
  compare_price: number | null;
  stock_qty: number;
  category_id: string | null;
  images: string[] | Json;
  benefits: string[] | null;
  application_rate: string | null;
  gst_hsn: string | null;
  gst_rate: number;
  status: 'active' | 'draft' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  sort_order: number;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string | null;
  session_id: string | null;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  items: Json;
  subtotal: number;
  gst_total: number;
  shipping: number;
  total: number;
  shipping_address: Json;
  billing_address: Json | null;
  payment_method: string | null;
  payment_id: string | null;
  payment_status: string;
  idempotency_key: string;
  // Flat address + GST split columns added in migration 002
  address_name: string | null;
  address_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  address_city: string | null;
  address_state: string | null;
  address_pincode: string | null;
  address_country: string | null;
  gst_type: 'IGST' | 'CGST_SGST' | null;
  igst_amount: number | null;
  cgst_amount: number | null;
  sgst_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  gst_rate: number;
  gst_amount: number;
  hsn_code: string;
  line_total: number;
}

export interface CartItemRow {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string | null;
  to_status: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

export interface WebhookLog {
  id: string;
  provider: string;
  payload: Json;
  signature_valid: boolean | null;
  processed: boolean;
  error: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  before: Json | null;
  after: Json | null;
  ip: string | null;
  created_at: string;
}

export interface WishlistRow {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      products: { Row: Product; Insert: Partial<Product>; Update: Partial<Product>; Relationships: [] };
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category>; Relationships: [] };
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order>; Relationships: [] };
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem>; Relationships: [] };
      cart_items: { Row: CartItemRow; Insert: Partial<CartItemRow>; Update: Partial<CartItemRow>; Relationships: [] };
      order_status_history: { Row: OrderStatusHistory; Insert: Partial<OrderStatusHistory>; Update: Partial<OrderStatusHistory>; Relationships: [] };
      webhook_logs: { Row: WebhookLog; Insert: Partial<WebhookLog>; Update: Partial<WebhookLog>; Relationships: [] };
      audit_log: { Row: AuditLog; Insert: Partial<AuditLog>; Update: Partial<AuditLog>; Relationships: [] };
      wishlist: { Row: WishlistRow; Insert: Partial<WishlistRow>; Update: Partial<WishlistRow>; Relationships: [] };
    };
    Views: Record<string, never>;
    Functions: {
      decrement_stock: { Args: { p_product_id: string; p_qty: number }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}