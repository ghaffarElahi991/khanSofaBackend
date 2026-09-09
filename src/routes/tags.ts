import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    const groups = await prisma.tagGroup.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        tags: { orderBy: { sortOrder: "asc" } },
      },
    });

    res.json(
      groups.map((g) => ({
        id: g.id,
        name: g.name,
        slug: g.slug,
        tags: g.tags.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
        })),
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch tags" });
  }
});

export default router;
