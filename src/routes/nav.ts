import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

type NavNode = {
  id: number;
  label: string;
  href: string | null;
  tagSlug: string | null;
  sortOrder: number;
  children: NavNode[];
};

function buildNavTree(
  items: Array<{
    id: number;
    label: string;
    href: string | null;
    tagId: number | null;
    parentId: number | null;
    sortOrder: number;
    tag: { slug: string } | null;
  }>
): NavNode[] {
  const map = new Map<number, NavNode>();
  const roots: NavNode[] = [];

  for (const item of items) {
    map.set(item.id, {
      id: item.id,
      label: item.label,
      href: item.href || (item.tag ? `/shop?tag=${item.tag.slug}` : null),
      tagSlug: item.tag?.slug || null,
      sortOrder: item.sortOrder,
      children: [],
    });
  }

  for (const item of items) {
    const node = map.get(item.id)!;
    if (item.parentId && map.has(item.parentId)) {
      map.get(item.parentId)!.children.push(node);
    } else if (!item.parentId) {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: NavNode[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    nodes.forEach((n) => sortNodes(n.children));
  };
  sortNodes(roots);

  return roots;
}

router.get("/shop-categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { id: "asc" },
      include: { _count: { select: { products: true } } },
    });

    res.json(
      categories.map((category) => ({
        id: category.id,
        label: category.name,
        href: `/shop?category=${category.slug}`,
        imageUrl: category.imageUrl,
        productCount: category._count.products,
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch shop categories" });
  }
});

router.get("/", async (_req, res) => {
  try {
    const items = await prisma.navItem.findMany({
      where: { isVisible: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { tag: { select: { slug: true } } },
    });
    res.json(buildNavTree(items));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch navigation" });
  }
});

export default router;
