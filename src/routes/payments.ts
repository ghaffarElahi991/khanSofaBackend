import { authenticate, type AuthRequest } from "../middleware/auth";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  attachStripeSession,
  cancelUnpaidOrder,
  createOrder,
  createOrderSchema,
  markOrderPaid,
  serializeOrder,
} from "../lib/order-service";
import { getStripe, isStripeEnabled } from "../lib/stripe";
import { sendPaymentConfirmation } from "../lib/email";

const router = Router();

router.get("/config", (_req, res) => {
  res.json({
    stripeEnabled: isStripeEnabled(),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || "",
  });
});

router.post("/create-checkout-session", (req, res, next) => {
  if (req.headers.authorization) return authenticate(req, res, next);
  next();
}, async (req: AuthRequest, res) => {
  try {
    if (!isStripeEnabled()) {
      return res.status(503).json({ error: "Card payments are not configured" });
    }

    const input = createOrderSchema.omit({ paymentMethod: true }).parse(req.body);
    const { order } = await createOrder({ ...input, paymentMethod: "CARD" }, req.user?.id);

    try {
      const stripe = getStripe();
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        success_url:
          `${frontendUrl}/checkout/success?orderNumber=${encodeURIComponent(order.orderNumber)}` +
          `&email=${encodeURIComponent(order.customerEmail)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/checkout`,
        customer_email: order.customerEmail,
        metadata: {
          orderId: String(order.id),
          orderNumber: order.orderNumber,
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              product_data: {
                name: `Order ${order.orderNumber}`,
                description: `${order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s) from Khan Sofa`,
              },
              unit_amount: Math.round(Number(order.total) * 100),
            },
          },
        ],
        payment_intent_data: {
          metadata: {
            orderId: String(order.id),
            orderNumber: order.orderNumber,
          },
        },
      });

      if (!session.url) {
        throw new Error("Stripe did not return a checkout URL");
      }

      await attachStripeSession(order.id, session.id);
      return res.json({ url: session.url, order: serializeOrder(order) });
    } catch (error) {
      await cancelUnpaidOrder(order.id);
      throw error;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    if (error instanceof Error) {
      if (error.message.includes("Insufficient stock") || error.message.includes("not found")) {
        return res.status(400).json({ error: error.message });
      }
      console.error(error);
      return res.status(500).json({ error: error.message || "Payment session failed" });
    }
    console.error(error);
    return res.status(500).json({ error: "Payment session failed" });
  }
});

router.get("/session", async (req, res) => {
  try {
    if (!isStripeEnabled()) {
      return res.status(503).json({ error: "Card payments are not configured" });
    }

    const { session_id: sessionId } = z
      .object({ session_id: z.string().min(1) })
      .parse(req.query);

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["payment_intent"],
    });

    const order = await prisma.order.findUnique({
      where: { stripeSessionId: session.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, primaryImageUrl: true } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found for payment session" });
    }

    if (session.payment_status === "paid" && order.paymentStatus !== "PAID") {
      const paidOrder = await markOrderPaid(
        order.id,
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null
      );
      void sendPaymentConfirmation(paidOrder).catch((error) =>
        console.error("Payment confirmation email failed", error)
      );
    }

    if (session.status === "expired" && order.paymentStatus !== "PAID") {
      await cancelUnpaidOrder(order.id);
    }

    const freshOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, primaryImageUrl: true } },
          },
        },
      },
    });

    res.json({
      sessionId: session.id,
      status: session.status,
      paymentStatus: session.payment_status,
      order: freshOrder ? serializeOrder(freshOrder) : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0].message });
    }
    console.error(error);
    res.status(500).json({ error: "Failed to fetch payment session" });
  }
});

export default router;
