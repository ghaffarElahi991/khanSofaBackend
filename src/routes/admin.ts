import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { serializeProduct, slugify } from "../lib/serializers";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
router.use(authenticate, requireAdmin);

const productSchema = z.object({
  sku: z.string().min(2).optional().nullable(),
  categoryId: z.number(),
  name: z.string().min(2),
  shortDescription: z.string().min(2),
  brand: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().int().min(0).default(0),
  rating: z.number().min(0).max(5).default(0),
  reviewCount: z.number().int().min(0).default(0),
  primaryImageUrl: z.string().url(),
  secondaryImageUrl: z.string().url().optional().nullable(),
  images: z.array(z.string().url()).min(1).optional(),
  description: z.string().min(2),
  status: z.string().default("In Stock"),
  isNewArrival: z.boolean().default(false),
  isBestSeller: z.boolean().default(false),
  colors: z.array(z.string()).default([]),
  configurations: z.array(z.string()).default([]),
  furnitureType: z.string().min(2).default("Other"),
  material: z.string().min(2),
  upholsteryMaterial: z.string().optional().nullable(),
  frameMaterial: z.string().optional().nullable(),
  cushionFilling: z.string().optional().nullable(),
  finish: z.string().optional().nullable(),
  room: z.string().min(2),
  dimensions: z.string().min(2),
  widthCm: z.number().positive().optional().nullable(),
  depthCm: z.number().positive().optional().nullable(),
  heightCm: z.number().positive().optional().nullable(),
  seatHeightCm: z.number().positive().optional().nullable(),
  seatingCapacity: z.number().int().positive().optional().nullable(),
  weightKg: z.number().positive().optional().nullable(),
  maxLoadKg: z.number().positive().optional().nullable(),
  assemblyRequired: z.boolean().default(false),
  warrantyMonths: z.number().int().min(0).default(12),
  careInstructions: z.string().optional().nullable(),
});

const categorySchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  description: z.string().optional(),
  imageUrl: z.string().url(),
});

const couponSchema = z.object({
  code: z.string().min(3),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.number().positive(),
  isActive: z.boolean().default(true),
  expiresAt: z.string().datetime().optional().nullable(),
});

// Dashboard stats
router.get("/stats", async (_req, res) => {
  try {
    const [products, orders, customers, revenue] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.user.count({ where: { role: "CUSTOMER" } }),
      prisma.order.aggregate({ _sum: { total: true } }),
    ]);

    res.json({
      products,
      orders,
      customers,
      revenue: Number(revenue._sum.total || 0),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// Products CRUD
router.get("/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: { select: { name: true, slug: true } } },
    });
    res.json(products.map(serializeProduct));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const parsed = productSchema.parse(req.body);
    const images = parsed.images || [parsed.primaryImageUrl, parsed.secondaryImageUrl].filter((url): url is string => Boolean(url));
    const data = {
      ...parsed,
      images,
      primaryImageUrl: images[0],
      secondaryImageUrl: images[1] || null,
    };
    const product = await prisma.product.create({
      data,
      include: { category: { select: { name: true, slug: true } } },
    });
    res.status(201).json(serializeProduct(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

router.put("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const parsed = productSchema.partial().parse(req.body);
    const data = parsed.images
      ? {
          ...parsed,
          primaryImageUrl: parsed.images[0],
          secondaryImageUrl: parsed.images[1] || null,
        }
      : parsed;
    const product = await prisma.product.update({
      where: { id },
      data,
      include: { category: { select: { name: true, slug: true } } },
    });
    res.json(serializeProduct(product));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to update product" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    await prisma.product.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// Categories CRUD
router.get("/categories", async (_req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } },
    });
    res.json(categories);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const data = categorySchema.parse(req.body);
    const category = await prisma.category.create({
      data: {
        ...data,
        slug: data.slug || slugify(data.name),
      },
    });
    res.status(201).json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create category" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = categorySchema.partial().parse(req.body);
    const category = await prisma.category.update({
      where: { id },
      data: {
        ...data,
        ...(data.name && !data.slug ? { slug: slugify(data.name) } : {}),
      },
    });
    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to update category" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const count = await prisma.product.count({ where: { categoryId: id } });
    if (count > 0) {
      return res.status(400).json({ error: "Cannot delete category with products" });
    }
    await prisma.category.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to delete category" });
  }
});

// Orders
router.get("/orders", async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, primaryImageUrl: true } },
          },
        },
      },
    });

    res.json(
      orders.map((order) => ({
        ...order,
        subtotal: Number(order.subtotal),
        shippingCost: Number(order.shippingCost),
        discount: Number(order.discount),
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          price: Number(item.price),
        })),
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

router.patch("/orders/:id/status", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = z
      .object({
        status: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"]),
      })
      .parse(req.body);

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    res.json({
      ...order,
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      total: Number(order.total),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Customers
router.get("/customers", async (_req, res) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        _count: { select: { orders: true } },
      },
    });
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Coupons
router.get("/coupons", async (_req, res) => {
  try {
    const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
    res.json(
      coupons.map((coupon) => ({
        ...coupon,
        discountValue: Number(coupon.discountValue),
      }))
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch coupons" });
  }
});

router.post("/coupons", async (req, res) => {
  try {
    const data = couponSchema.parse(req.body);
    const coupon = await prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        discountType: data.discountType,
        discountValue: data.discountValue,
        isActive: data.isActive,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
    });
    res.status(201).json({ ...coupon, discountValue: Number(coupon.discountValue) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to create coupon" });
  }
});

router.patch("/coupons/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = couponSchema.partial().parse(req.body);
    const coupon = await prisma.coupon.update({
      where: { id },
      data: {
        ...data,
        ...(data.code ? { code: data.code.toUpperCase() } : {}),
        ...(data.expiresAt !== undefined
          ? { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }
          : {}),
      },
    });
    res.json({ ...coupon, discountValue: Number(coupon.discountValue) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to update coupon" });
  }
});

// CSV import — matches spreadsheet columns
router.post("/products/import", async (req: AuthRequest, res) => {
  try {
    const { rows } = z
      .object({
        rows: z.array(
          z.object({
            category: z.string(),
            name: z.string(),
            shortDescription: z.string(),
            brand: z.string(),
            price: z.number(),
            stock: z.number().int().default(0),
            rating: z.number().default(0),
            primaryImageUrl: z.string().url(),
            secondaryImageUrl: z.string().url().optional(),
            description: z.string(),
            status: z.string().default("In Stock"),
            isNewArrival: z.boolean().optional(),
            isBestSeller: z.boolean().optional(),
            colors: z.array(z.string()).optional(),
            configurations: z.array(z.string()).optional(),
            material: z.string().default("Mixed materials"),
            room: z.string().default("Living Room"),
            dimensions: z.string().default("See product description"),
            weightKg: z.number().positive().optional(),
            assemblyRequired: z.boolean().optional(),
            warrantyMonths: z.number().int().min(0).optional(),
            careInstructions: z.string().optional(),
          })
        ),
      })
      .parse(req.body);

    const categories = await prisma.category.findMany();
    const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    const created = [];
    for (const row of rows) {
      let categoryId = categoryMap.get(row.category.toLowerCase());

      if (!categoryId) {
        const newCategory = await prisma.category.create({
          data: {
            name: row.category,
            slug: slugify(row.category),
            imageUrl: row.primaryImageUrl,
          },
        });
        categoryId = newCategory.id;
        categoryMap.set(row.category.toLowerCase(), categoryId);
      }

      const product = await prisma.product.create({
        data: {
          categoryId,
          name: row.name,
          shortDescription: row.shortDescription,
          brand: row.brand,
          price: row.price,
          stock: row.stock,
          rating: row.rating,
          primaryImageUrl: row.primaryImageUrl,
          secondaryImageUrl: row.secondaryImageUrl,
          description: row.description,
          status: row.status,
          isNewArrival: row.isNewArrival ?? false,
          isBestSeller: row.isBestSeller ?? false,
          colors: row.colors ?? [],
          configurations: row.configurations ?? ["Standard"],
          material: row.material,
          room: row.room,
          dimensions: row.dimensions,
          weightKg: row.weightKg,
          assemblyRequired: row.assemblyRequired ?? false,
          warrantyMonths: row.warrantyMonths ?? 12,
          careInstructions: row.careInstructions,
        },
        include: { category: { select: { name: true, slug: true } } },
      });

      created.push(serializeProduct(product));
    }

    res.status(201).json({ imported: created.length, products: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to import products" });
  }
});

export default router;
