import type { ProductRecord } from "./product-types";

export type ProductSeoAudience = "consumer" | "horeca";

export interface ProductSeoMetadata {
  title: string;
  description: string;
  canonicalRoute: string;
  openGraphTitle: string;
  openGraphDescription: string;
  twitterTitle: string;
  twitterDescription: string;
}

export function getProductSeo(
  product: ProductRecord,
  audience: ProductSeoAudience,
): ProductSeoMetadata {
  const consumer = product.retail;
  const data = audience === "horeca" ? product.horeca : consumer;
  const title =
    audience === "horeca"
      ? `${consumer.title} ${data.weightLabel} для HoReCa | PASTODEL`
      : `${consumer.title} ${data.weightLabel} | PASTODEL`;
  const description =
    audience === "horeca"
      ? `${consumer.title} PASTODEL в формате ${data.weightLabel} для HoReCa: состав, приготовление, хранение и информация о продукте.`
      : `${consumer.seoDescription} Формат: ${data.weightLabel}.`;

  return {
    title,
    description,
    canonicalRoute: data.route,
    openGraphTitle: title,
    openGraphDescription: description,
    twitterTitle: title,
    twitterDescription: description,
  };
}
