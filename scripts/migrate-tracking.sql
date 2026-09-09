ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingToken" TEXT NOT NULL DEFAULT gen_random_uuid()::text;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "trackingUrl" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_trackingToken_key" ON "Order"("trackingToken");
