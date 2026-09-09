export function buildProductWhere(query: Record<string, unknown>) {
  const {
    category,
    minPrice,
    maxPrice,
    search,
    newArrivals,
    bestSellers,
    inStock,
    brand,
    tag,
  } = query;

  const where: Record<string, unknown> = {};

  if (category && category !== "all") {
    where.category = { slug: String(category) };
  }

  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: "insensitive" } },
      { shortDescription: { contains: String(search), mode: "insensitive" } },
      { brand: { contains: String(search), mode: "insensitive" } },
      { description: { contains: String(search), mode: "insensitive" } },
    ];
  }

  if (brand && brand !== "all") {
    where.brand = { equals: String(brand), mode: "insensitive" };
  }

  if (tag && tag !== "all") {
    where.tags = { some: { slug: String(tag) } };
  }

  if (minPrice || maxPrice) {
    where.price = {
      ...(minPrice ? { gte: Number(minPrice) } : {}),
      ...(maxPrice ? { lte: Number(maxPrice) } : {}),
    };
  }

  if (newArrivals === "true") where.isNewArrival = true;
  if (bestSellers === "true") where.isBestSeller = true;
  if (inStock === "true") {
    where.status = { not: "Out of Stock" };
    where.stock = { gt: 0 };
  }

  return where;
}

export function buildProductOrderBy(sort: string) {
  if (sort === "price-asc") return { price: "asc" as const };
  if (sort === "price-desc") return { price: "desc" as const };
  if (sort === "best-selling") return { reviewCount: "desc" as const };
  if (sort === "name-asc") return { name: "asc" as const };
  if (sort === "name-desc") return { name: "desc" as const };
  return { createdAt: "desc" as const };
}

export function serializeProductList(
  products: Array<{
    price: { toString(): string } | number | string;
    category: { name: string; slug: string };
    tags?: Array<{ name: string; slug: string }>;
    [key: string]: unknown;
  }>
) {
  return products.map((p) => {
    const { category, tags, weightKg, widthCm, depthCm, heightCm, seatHeightCm, maxLoadKg, ...rest } = p;
    return {
      ...rest,
      price: Number(p.price),
      weightKg: weightKg == null ? null : Number(weightKg),
      widthCm: widthCm == null ? null : Number(widthCm),
      depthCm: depthCm == null ? null : Number(depthCm),
      heightCm: heightCm == null ? null : Number(heightCm),
      seatHeightCm: seatHeightCm == null ? null : Number(seatHeightCm),
      maxLoadKg: maxLoadKg == null ? null : Number(maxLoadKg),
      category: category.name,
      categorySlug: category.slug,
      tags: tags?.map((t) => ({ name: t.name, slug: t.slug })) || [],
    };
  });
}
