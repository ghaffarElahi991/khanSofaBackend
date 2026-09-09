import { prisma } from "./prisma";
import { slugify } from "./serializers";
import { parseShopifyCsv, type ParsedProduct } from "./shopify-csv";

/** Remove all products and related order/review data. Keeps users, tags, nav, categories, coupons. */
export async function clearAllProducts() {
  const [orderItems, orders, reviews, products] = await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.review.deleteMany(),
    prisma.product.deleteMany(),
  ]);

  return {
    orderItemsDeleted: orderItems.count,
    ordersDeleted: orders.count,
    reviewsDeleted: reviews.count,
    productsDeleted: products.count,
  };
}

async function getOrCreateCategory(name: string, imageUrl: string) {
  const slug = slugify(name);
  const existing = await prisma.category.findFirst({
    where: { OR: [{ name }, { slug }] },
  });

  if (existing) return existing;

  return prisma.category.create({
    data: {
      name,
      slug,
      description: `${name} collection`,
      imageUrl,
    },
  });
}

async function resolveTagIds(tagNames: string[]) {
  if (tagNames.length === 0) return [];

  const allTags = await prisma.tag.findMany();
  const map = new Map(allTags.map((t) => [t.name.toLowerCase(), t.id]));

  return tagNames
    .map((name) => map.get(name.trim().toLowerCase()))
    .filter((id): id is number => id !== undefined);
}

export async function importProductsFromCsv(csvContent: string) {
  const parsed = parseShopifyCsv(csvContent);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const item of parsed) {
    try {
      const category = await getOrCreateCategory(
        item.categoryName,
        item.images[0]
      );

      const tagIds = await resolveTagIds(item.tagNames);
      const data = {
        ...toProductData(item, category.id),
        tags: tagIds.length ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      };

      const existing = await prisma.product.findUnique({
        where: { handle: item.handle },
      });

      if (existing) {
        await prisma.product.update({
          where: { handle: item.handle },
          data: {
            ...toProductData(item, category.id),
            tags: { set: tagIds.map((id) => ({ id })) },
          },
        });
        updated++;
      } else {
        await prisma.product.create({ data });
        created++;
      }
    } catch (err) {
      errors.push(
        `${item.handle}: ${err instanceof Error ? err.message : "Import failed"}`
      );
    }
  }

  return {
    total: parsed.length,
    created,
    updated,
    errors,
  };
}

export async function importProductsFromCsvFresh(csvContent: string) {
  const cleared = await clearAllProducts();
  const imported = await importProductsFromCsv(csvContent);
  return { cleared, ...imported };
}

function toProductData(item: ParsedProduct, categoryId: number) {
  const category = item.categoryName.toLowerCase();
  const name = item.name.toLowerCase();
  const furnitureType = category.includes("sofa")
    ? (name.includes("sectional") || name.includes("modular") ? "Sectional Sofa" : "Sofa")
    : category.includes("chair")
      ? (name.includes("dining") ? "Dining Chair" : name.includes("office") ? "Office Chair" : "Armchair")
      : category.includes("table")
        ? (name.includes("dining") ? "Dining Table" : name.includes("coffee") ? "Coffee Table" : "Side Table")
        : category.includes("bed")
          ? "Bed"
          : category.includes("storage")
            ? (name.includes("media") || name.includes("console") ? "Media Console" : "Cabinet")
            : category.includes("outdoor")
              ? "Outdoor Furniture"
              : "Other";

  return {
    handle: item.handle,
    categoryId,
    name: item.name,
    shortDescription: item.shortDescription,
    brand: item.brand,
    price: item.price,
    stock: item.stock,
    primaryImageUrl: item.images[0],
    secondaryImageUrl: item.images[1] || null,
    images: item.images,
    description: item.description,
    status: item.status,
    isNewArrival: item.isNewArrival,
    isBestSeller: item.isBestSeller || item.tagNames.some((t) =>
      t.toLowerCase().includes("best seller")
    ),
    colors: item.colors,
    configurations: item.configurations,
    furnitureType,
    material: "Mixed materials",
    room: item.categoryName === "Beds"
      ? "Bedroom"
      : item.categoryName === "Outdoor"
        ? "Outdoor"
        : item.categoryName === "Tables" || item.categoryName === "Chairs"
          ? "Dining Room"
          : "Living Room",
    dimensions: "See product description",
    assemblyRequired: false,
    warrantyMonths: 12,
    careInstructions: "Follow the care information supplied with the product.",
  };
}
