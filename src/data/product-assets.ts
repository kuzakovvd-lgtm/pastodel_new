import type { ImageMetadata } from 'astro';

const modules = import.meta.glob('../assets/products/*.webp', {
  eager: true,
  import: 'default'
}) as Record<string, ImageMetadata>;

export function getProductAsset(fileName: string): ImageMetadata | undefined {
  const key = Object.keys(modules).find((entry) => entry.endsWith(`/${fileName}`));
  return key ? modules[key] : undefined;
}
