import { Router } from "express";
import { z } from "zod";
import { isEmailConfigured, MailDeliveryError, sendSubscriptionThankYou } from "../lib/email";

const router = Router();
const schema = z.object({ email: z.string().trim().max(254).email() });
// Bound repeated sends per process, including requests still in flight.
const attempts = new Map<string, { count: number; expires: number }>();

router.post("/subscribe", async (req, res) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Please enter a valid email address." });
    return;
  }
  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Subscriptions are temporarily unavailable. Please try again later." });
    return;
  }

  const now = Date.now();
  for (const [key, value] of attempts) {
    if (value.expires <= now) attempts.delete(key);
  }
  const keys = [`ip:${req.ip}`, `email:${parsed.data.email.toLowerCase()}`];
  if (keys.some((key, index) => (attempts.get(key)?.count || 0) >= (index === 0 ? 5 : 1))) {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: "Please wait a minute before subscribing again." });
    return;
  }
  for (const key of keys) {
    const previous = attempts.get(key);
    attempts.set(key, { count: (previous?.count || 0) + 1, expires: previous?.expires || now + 60_000 });
  }

  try {
    await sendSubscriptionThankYou(parsed.data.email);
    res.json({ message: "Thank you for subscribing! Check your inbox for a welcome email." });
  } catch (error) {
    console.error("Newsletter welcome email failed", {
      code: error instanceof MailDeliveryError ? error.code : undefined,
      reason: error instanceof MailDeliveryError
        ? "SMTP delivery failed; check the mailbox credentials and SMTP connection"
        : "Mail request failed or timed out",
    });
    res.status(502).json({ error: "We couldn't send your welcome email. Please try again shortly." });
  }
});

export default router;
