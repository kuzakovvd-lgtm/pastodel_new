import type { ImageMetadata } from 'astro';

export type ProductCategory = 'pasta' | 'risotto' | 'paella';
export const PRODUCT_SLUGS = [
  'alfredo-kuritsa',
  'karbonara',
  'mak-end-chiz',
  'vetchina-griby-slivochny-sous',
  'pasta-frikadelki-tomatny-sous',
  'chetyre-syra',
  'kuritsa-pesto-vyalenye-tomaty',
  'primavera',
  'rizotto-rizi-bizi-pesto-zeleny-goroshek',
  'rizotto-griby-slivochny-sous',
  'paelya-kuritsa-ovoshchi'
] as const;
export type ProductSlug = (typeof PRODUCT_SLUGS)[number];

export interface ProductNutrition {
  [key: string]: string;
}

export interface ProductAudienceData {
  title: string;
  route: string;
  imageAsset: ImageMetadata;
  weightLabel: string;
  description: string;
  stats: string[];
  seoTitle: string;
  seoDescription: string;
  h1: string;
  heroDescriptor: string;
  heroSummary: string;
  ingredientChips: string[];
  fullComposition: string;
  facts: string[];
  prep: {
    microwave: string;
    pan: string;
  };
  nutrition100: ProductNutrition;
  nutritionPortion: ProductNutrition;
  packLabel: string;
  cta: {
    label: string;
    href: string;
  };
}

export type ProductAudienceContent = Omit<ProductAudienceData, 'imageAsset'>;

export interface ProductRecordBase {
  slug: ProductSlug;
  category: ProductCategory;
  line: string;
  ingredientsTag: string;
  vegetarian: boolean;
  caloriesPer100: number;
  audienceSupportNote: string;
  retail: ProductAudienceContent;
  horeca: ProductAudienceContent;
}

export interface ProductRecord extends Omit<ProductRecordBase, 'retail' | 'horeca'> {
  retail: ProductAudienceData;
  horeca: ProductAudienceData;
}

export type ProductAudience = 'retail' | 'horeca';
