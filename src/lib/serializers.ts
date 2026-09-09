export function serializeProduct(
  product: {
    price: { toString(): string } | number | string;
    category?: { name: string; slug: string };
    [key: string]: unknown;
  }
) {
  const {
    category,
    weightKg,
    widthCm,
    depthCm,
    heightCm,
    seatHeightCm,
    maxLoadKg,
    ...rest
  } = product;
  return {
    ...rest,
    price: Number(product.price),
    weightKg: weightKg == null ? null : Number(weightKg),
    widthCm: widthCm == null ? null : Number(widthCm),
    depthCm: depthCm == null ? null : Number(depthCm),
    heightCm: heightCm == null ? null : Number(heightCm),
    seatHeightCm: seatHeightCm == null ? null : Number(seatHeightCm),
    maxLoadKg: maxLoadKg == null ? null : Number(maxLoadKg),
    ...(category
      ? { category: category.name, categorySlug: category.slug }
      : {}),
  };
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
