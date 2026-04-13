import type { ImageMetadata } from 'astro';
import { PRODUCT_SLUGS, type ProductAudience, type ProductSlug } from './product-types';

const modules = import.meta.glob('../assets/products/*.webp', {
  eager: true,
  import: 'default'
}) as Record<string, ImageMetadata>;

type ProductAssetKey = `${ProductSlug}:${ProductAudience}`;

function getBaseName(modulePath: string): string {
  const fileName = modulePath.split('/').pop() ?? modulePath;
  const withoutExt = fileName.replace(/\.webp$/, '');
  return withoutExt.replace(/\.[^.]+$/, '');
}

function toAssetKey(baseName: string): ProductAssetKey | undefined {
  const audience: ProductAudience = baseName.endsWith('-horeca') ? 'horeca' : 'retail';
  const slug = audience === 'horeca' ? baseName.slice(0, -'-horeca'.length) : baseName;
  if (!(PRODUCT_SLUGS as readonly string[]).includes(slug)) {
    return undefined;
  }
  return `${slug as ProductSlug}:${audience}`;
}

function buildAssetRegistry(): Record<ProductAssetKey, ImageMetadata> {
  const registry = {} as Record<ProductAssetKey, ImageMetadata>;

  for (const [modulePath, image] of Object.entries(modules)) {
    const key = toAssetKey(getBaseName(modulePath));
    if (!key) {
      continue;
    }
    registry[key] = image;
  }

  const missingKeys = PRODUCT_SLUGS.flatMap((slug) => {
    const retailKey = `${slug}:retail` as ProductAssetKey;
    const horecaKey = `${slug}:horeca` as ProductAssetKey;
    return [retailKey, horecaKey].filter((key) => !registry[key]);
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing product assets in registry: ${missingKeys.join(', ')}`);
  }

  return registry;
}

const assetRegistry = buildAssetRegistry();

export function getProductAsset(slug: ProductSlug, audience: ProductAudience): ImageMetadata {
  return assetRegistry[`${slug}:${audience}` as ProductAssetKey];
}
