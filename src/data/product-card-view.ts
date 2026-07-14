import type { ImageMetadata } from "astro";
import type { ProductRecord } from "./product-types";
import { getCategoryLabel } from "./product-utils";

export type ProductCardAudience = "consumer" | "retailBuyer" | "horeca";

export interface ProductCardAction {
  label: string;
  href: string;
  style: "primary" | "secondary" | "text";
}

export interface ProductCardView {
  image: ImageMetadata;
  imageAlt: string;
  title: string;
  mediaHref: string;
  badge: string;
  weightLabel: string;
  description: string;
  stats: string[];
  actions: ProductCardAction[];
}

function getConsumerBadge(line: ProductRecord["line"]): string {
  if (line === "casa") return "Классика на каждый день";
  if (line === "chef") return "Сытные блюда";
  return "Лёгкие вкусы";
}

export function getRetailProductRequestHref(product: ProductRecord): string {
  return `/partneram/?product=${product.slug}&request=conditions#partner-form`;
}

export function getHorecaTastingHref(product: ProductRecord): string {
  return `/horeca/?product=${product.slug}#horeca-request`;
}

export function getProductCardView(
  product: ProductRecord,
  audience: ProductCardAudience,
): ProductCardView {
  if (audience === "retailBuyer") {
    const requestHref = getRetailProductRequestHref(product);

    return {
      image: product.retail.imageAsset,
      imageAlt: product.retail.title,
      title: product.retail.title,
      mediaHref: requestHref,
      badge: "Для ритейла",
      weightLabel: product.retail.weightLabel,
      description: product.retail.description,
      stats: [getCategoryLabel(product.category), product.retail.packLabel],
      actions: [
        {
          label: "Запросить условия по позиции",
          href: requestHref,
          style: "primary",
        },
      ],
    };
  }

  if (audience === "horeca") {
    const tastingHref = getHorecaTastingHref(product);

    return {
      image: product.horeca.imageAsset,
      imageAlt: product.horeca.title,
      title: product.horeca.title,
      mediaHref: product.horeca.route,
      badge: "Для HoReCa",
      weightLabel: product.horeca.weightLabel,
      description: product.horeca.description,
      stats: product.horeca.stats,
      actions: [
        {
          label: "Выбрать для дегустации",
          href: tastingHref,
          style: "primary",
        },
        {
          label: "Карточка HoReCa",
          href: product.horeca.route,
          style: "secondary",
        },
      ],
    };
  }

  return {
    image: product.retail.imageAsset,
    imageAlt: product.retail.title,
    title: product.retail.title,
    mediaHref: product.retail.route,
    badge: getConsumerBadge(product.line),
    weightLabel: product.retail.weightLabel,
    description: product.retail.description,
    stats: product.retail.stats,
    actions: [
      {
        label: "Подробнее",
        href: product.retail.route,
        style: "primary",
      },
      {
        label: product.retail.cta.label,
        href: product.retail.cta.href,
        style: "text",
      },
    ],
  };
}
