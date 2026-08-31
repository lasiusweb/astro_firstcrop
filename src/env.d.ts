/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_EASEBUZZ_KEY: string;
  readonly PUBLIC_EASEBUZZ_MODE: 'sandbox' | 'live';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface SessionData {
    cart: CartItem[];
    pendingCheckout: PendingCheckout | null;
  }

  interface Locals {
    claims: {
      userId: string;
      role: 'customer' | 'admin';
      phone: string;
    } | null;
  }
}

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  slug: string;
}

interface PendingCheckout {
  shippingAddress: ShippingAddress;
  items: CartItem[];
  subtotal: number;
  gstTotal: number;
  total: number;
}

interface ShippingAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}
