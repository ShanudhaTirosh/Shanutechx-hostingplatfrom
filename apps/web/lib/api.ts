export interface Plan {
  id: string;
  productId: string;
  name: string;
  price: number;
  currency: string;
  billingType: string;
  isPopular?: boolean;
  badge?: string | null;
  specsJson?: Record<string, any> | null;
  isActive: boolean;
}

export interface Product {
  id: string;
  category: string;
  name: string;
  slug: string;
  description?: string | null;
  iconUrl?: string | null;
  isPopular?: boolean;
  badge?: string | null;
  isActive: boolean;
  plans?: Plan[];
}

export const API_BASE =
  process.env.API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:4000';

/**
 * Fetch products and plans dynamically from DB via Express API.
 * Optionally filter by category.
 */
export async function fetchProducts(category?: string): Promise<Product[]> {
  try {
    const url = category ? `${API_BASE}/api/products?category=${encodeURIComponent(category)}` : `${API_BASE}/api/products`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) {
      console.error(`[web/api] fetchProducts returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data.products) ? data.products : [];
  } catch (error) {
    console.error('[web/api] fetchProducts network or parse error:', error);
    return [];
  }
}
