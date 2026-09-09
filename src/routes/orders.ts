import { authenticate, type AuthRequest } from "../middleware/auth";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { serializeOrder } from "../lib/order-service";

const router = Router();

router.get("/track/:token", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (!z.string().uuid().safeParse(req.params.token).success) return res.status(404).json({ error: "Tracking link not found" });
  const order = await prisma.order.findUnique({ where: { trackingToken: req.params.token as string }, select: { trackingUrl: true } });
  if (!order) return res.status(404).json({ error: "Tracking link not found" });
  res.json({ trackingUrl: order.trackingUrl });
});

router.get("/mine", authenticate, async (req: AuthRequest, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
    if (!Number.isInteger(page)) return res.status(400).json({ error: "Invalid page" });
    const where = { userId: req.user!.id };
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 10, take: 10,
        select: {
          id: true, orderNumber: true, createdAt: true, status: true, paymentStatus: true, total: true,
          subtotal: true, shippingCost: true, discount: true, paymentMethod: true,
          customerName: true, customerEmail: true, shippingAddress: true, city: true,
          state: true, country: true, postalCode: true, trackingToken: true,
          trackingUrl: true, orderNotes: true,
          items: { select: { id: true, quantity: true, color: true, configuration: true, price: true,
            product: { select: { id: true, name: true, primaryImageUrl: true } } } },
        },
      }),
      prisma.order.count({ where }),
    ]);
    res.json({ orders, totalPages: Math.ceil(total / 10) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Unable to load your orders. Please try again." });
  }
});

router.get("/confirmation", async (req, res) => {
  try {
    const orderNumber = String(req.query.orderNumber || "");
    const email = String(req.query.email || "").toLowerCase();

    if (!orderNumber || !email) {
      return res.status(400).json({ error: "Order number and email are required" });
    }

    const order = await prisma.order.findFirst({
      where: {
        orderNumber,
        customerEmail: { equals: email, mode: "insensitive" },
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, primaryImageUrl: true } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(serializeOrder(order));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

router.post("/", (_req, res) => {
  res.status(410).json({
    error: "Direct orders are disabled. Use the Stripe checkout endpoint.",
  });
});

router.post("/validate-coupon", async (req, res) => {
  try {
    const { code } = z.object({ code: z.string() }).parse(req.body);
    const coupon = await prisma.coupon.findFirst({
      where: {
        code: code.toUpperCase(),
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!coupon) {
      return res.status(404).json({ error: "Invalid or expired coupon" });
    }

    res.json({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
    });
  } catch {
    res.status(400).json({ error: "Invalid coupon code" });
  }
});

export default router;
