ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "stripeSessionId" TEXT,
ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_stripeSessionId_key"
ON "Order"("stripeSessionId");
