import type { ImageMetadata } from 'astro';

export type ProductCategory = 'pasta' | 'risotto' | 'paella';

export interface ProductNutrition {
  [key: string]: string;
}

export interface ProductAudienceData {
  title: string;
  route: string;
  image: string;
  imageAsset?: ImageMetadata;
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

export interface ProductRecord {
  slug: string;
  category: ProductCategory;
  line: string;
  ingredientsTag: string;
  vegetarian: boolean;
  caloriesPer100: number;
  audienceSupportNote: string;
  retail: ProductAudienceData;
  horeca: ProductAudienceData;
}

export type ProductAudience = 'retail' | 'horeca';
