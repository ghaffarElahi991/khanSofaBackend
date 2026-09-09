import { Router } from "express";
import Stripe from "stripe";
import { cancelUnpaidOrder, markOrderPaid } from "../lib/order-service";
import { prisma } from "../lib/prisma";
import { getStripe, getStripeWebhookSecret } from "../lib/stripe";
import { sendPaymentConfirmation } from "../lib/email";

const router = Router();

router.post("/", async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature || Array.isArray(signature)) {
    return res.status(400).send("Missing Stripe signature");
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      getStripeWebhookSecret()
    );

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status !== "paid") break;
        const orderId = Number(session.metadata?.orderId || 0);
        if (orderId) {
          const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
          const paidOrder = await markOrderPaid(
            orderId,
            typeof session.payment_intent === "string" ? session.payment_intent : null
          );
          if (existingOrder?.paymentStatus !== "PAID") {
            void sendPaymentConfirmation(paidOrder).catch((error) =>
              console.error("Payment confirmation email failed", error)
            );
          }
        }
        break;
      }
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = Number(session.metadata?.orderId || 0);
        if (orderId) {
          await cancelUnpaidOrder(orderId);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const orderId = Number(paymentIntent.metadata?.orderId || 0);
        if (orderId) {
          await cancelUnpaidOrder(orderId);
        } else {
          const order = await prisma.order.findFirst({
            where: { stripePaymentIntentId: paymentIntent.id },
          });
          if (order) {
            await cancelUnpaidOrder(order.id);
          }
        }
        break;
      }
      default:
        break;
    }

    return res.json({ received: true });
  } catch (error) {
    console.error(error);
    return res.status(400).send("Webhook Error");
  }
});

export default router;
