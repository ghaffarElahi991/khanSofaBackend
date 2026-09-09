import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true } },
        products: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: { primaryImageUrl: true },
        },
      },
    });

    res.json(
      categories.map(({ products, _count, ...cat }) => ({
        ...cat,
        imageUrl: products[0]?.primaryImageUrl || cat.imageUrl,
        productCount: _count.products,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

export default router;
