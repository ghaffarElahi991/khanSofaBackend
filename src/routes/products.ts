import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  buildProductOrderBy,
  buildProductWhere,
  serializeProductList,
} from "../lib/product-query";
import { serializeProduct } from "../lib/serializers";

const router = Router();

router.get("/brands", async (_req, res) => {
  try {
    const brands = await prisma.product.findMany({
      distinct: ["brand"],
      select: { brand: true },
      orderBy: { brand: "asc" },
    });
    res.json(brands.map((b) => b.brand));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch brands" });
  }
});

router.get("/", async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 12));
    const skip = (page - 1) * limit;

    const where = buildProductWhere(req.query);
    const orderBy = buildProductOrderBy(String(req.query.sort || "newest"));

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          category: { select: { name: true, slug: true } },
          tags: { select: { name: true, slug: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({
      products: serializeProductList(products),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: { select: { name: true, slug: true } },
        tags: { select: { name: true, slug: true } },
        reviews: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    const related = await prisma.product.findMany({
      where: {
        categoryId: product.categoryId,
        id: { not: product.id },
      },
      take: 4,
      include: { category: { select: { name: true, slug: true } } },
    });

    res.json({
      ...serializeProduct(product),
      tags: product.tags.map((t) => ({ name: t.name, slug: t.slug })),
      related: serializeProductList(related),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch product" });
  }
});

export default router;
