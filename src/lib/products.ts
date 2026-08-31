import { createServerClient } from './supabase/server';
import type { AstroCookies } from 'astro';
import type { Product, Category } from './database.types';
const PRODUCT_FIELDS = 'id, name, slug, description, short_desc, price, compare_price, stock_qty, images, benefits, gst_rate';

export interface ProductFilters {
  categories?: string[]; // category slugs
  priceMin?: number;
  priceMax?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'name';
  page?: number;
  perPage?: number;
}

export interface ProductListResult {
  products: Product[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

function unwrapImages(images: Product['images']): string {
  if (Array.isArray(images) && images.length > 0) return String(images[0]);
  return 'https://images.unsplash.com/photo-1592982537447-6f2a6a0c7c17?w=600';
}

/** Row shape normalized for ProductCard usage. */
export function toCardData(p: Product) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    comparePrice: p.compare_price != null ? Number(p.compare_price) : undefined,
    image: unwrapImages(p.images),
    shortDesc: p.short_desc ?? '',
  };
}

export async function listProducts(
  cookies: AstroCookies,
  filters: ProductFilters = {}
): Promise<ProductListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(48, Math.max(1, filters.perPage ?? 12));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const supabase = createServerClient(cookies);

  let query = supabase
    .from('products')
    .select(PRODUCT_FIELDS, { count: 'exact' })
    .eq('status', 'active');

  if (filters.categories?.length) {
    const { data: cats } = await supabase
      .from('categories')
      .select('id')
      .in('slug', filters.categories);
    const ids = (cats ?? []).map((c: Category) => c.id);
    query = ids.length ? query.in('category_id', ids) : query.eq('category_id', '00000000-0000-0000-0000-000000000000');
  }

  if (filters.priceMin != null) query = query.gte('price', filters.priceMin);
  if (filters.priceMax != null) query = query.lte('price', filters.priceMax);

  switch (filters.sort) {
    case 'price_asc': query = query.order('price', { ascending: true }); break;
    case 'price_desc': query = query.order('price', { ascending: false }); break;
    case 'name': query = query.order('name', { ascending: true }); break;
    default: query = query.order('created_at', { ascending: false });
  }

  const { data, error, count } = await query.range(from, to);

  if (error) throw new Error(`listProducts: ${error.message}`);

  const total = count ?? 0;
  return {
    products: (data ?? []) as Product[],
    total,
    page,
    perPage,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export async function getProductBySlug(
  cookies: AstroCookies,
  slug: string
): Promise<Product | null> {
  const supabase = createServerClient(cookies);
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS + ', application_rate, gst_hsn, category_id, categories (name, slug)')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (error || !data) return null;
  return data as unknown as Product;
}

export async function getCategoryBySlug(
  cookies: AstroCookies,
  slug: string
): Promise<Category | null> {
  const supabase = createServerClient(cookies);
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .single();
  return (data as Category) ?? null;
}

export async function listCategories(cookies: AstroCookies): Promise<Category[]> {
  const supabase = createServerClient(cookies);
  const { data } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order');
  return (data ?? []) as Category[];
}

/** Featured products for the homepage. Falls back gracefully when DB is unreachable. */
export async function getFeaturedProducts(cookies: AstroCookies, limit = 4): Promise<Product[]> {
  try {
    const { products } = await listProducts(cookies, { perPage: limit, sort: 'newest' });
    return products;
  } catch (err) {
    console.error('[products] featured fetch failed:', (err as Error).message);
    return [];
  }
}