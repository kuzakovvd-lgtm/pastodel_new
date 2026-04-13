import { products } from './products';
import type { ProductAudience, ProductAudienceData, ProductRecord } from './product-types';
import { getProductAsset } from './product-assets';

const enrichedProducts: ProductRecord[] = products.map((product) => ({
  ...product,
  retail: {
    ...product.retail,
    imageAsset: getProductAsset(product.slug, 'retail')
  },
  horeca: {
    ...product.horeca,
    imageAsset: getProductAsset(product.slug, 'horeca')
  }
}));

export function getProducts(): ProductRecord[] {
  return enrichedProducts;
}

export function getProductBySlug(slug: string): ProductRecord | undefined {
  return enrichedProducts.find((product) => product.slug === slug);
}

export function getAudienceData(product: ProductRecord, audience: ProductAudience): ProductAudienceData {
  return audience === 'horeca' ? product.horeca : product.retail;
}

export function getCategoryLabel(category: ProductRecord['category']): string {
  if (category === 'risotto') return 'Ризотто';
  if (category === 'paella') return 'Паэлья';
  return 'Паста';
}
