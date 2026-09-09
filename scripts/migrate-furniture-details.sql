ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sku" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "furnitureType" TEXT NOT NULL DEFAULT 'Other';
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "upholsteryMaterial" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "frameMaterial" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "cushionFilling" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "finish" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "widthCm" DECIMAL(8,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "depthCm" DECIMAL(8,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "heightCm" DECIMAL(8,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seatHeightCm" DECIMAL(8,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "seatingCapacity" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maxLoadKg" DECIMAL(8,2);

UPDATE "Product"
SET "status" = 'In Stock', "isNewArrival" = TRUE
WHERE "status" = 'New Arrival';

UPDATE "Product" AS product
SET "furnitureType" = CASE category."slug"
  WHEN 'sofas' THEN CASE WHEN product."name" ILIKE '%sectional%' OR product."name" ILIKE '%modular%' THEN 'Sectional Sofa' ELSE 'Sofa' END
  WHEN 'chairs' THEN CASE WHEN product."name" ILIKE '%dining%' THEN 'Dining Chair' WHEN product."name" ILIKE '%office%' THEN 'Office Chair' ELSE 'Armchair' END
  WHEN 'tables' THEN CASE WHEN product."name" ILIKE '%dining%' THEN 'Dining Table' WHEN product."name" ILIKE '%coffee%' THEN 'Coffee Table' ELSE 'Side Table' END
  WHEN 'beds' THEN 'Bed'
  WHEN 'storage' THEN CASE WHEN product."name" ILIKE '%bedside%' THEN 'Bedside Table' WHEN product."name" ILIKE '%media%' OR product."name" ILIKE '%console%' THEN 'Media Console' WHEN product."name" ILIKE '%book%' THEN 'Bookshelf' ELSE 'Cabinet' END
  WHEN 'outdoor' THEN 'Outdoor Furniture'
  ELSE product."furnitureType"
END
FROM "Category" AS category
WHERE product."categoryId" = category."id"
  AND product."furnitureType" IN ('Other', 'Chair', 'Table', 'Storage');

UPDATE "Product" AS product
SET
  "sku" = COALESCE(product."sku", seed.sku),
  "upholsteryMaterial" = COALESCE(product."upholsteryMaterial", seed.upholstery),
  "frameMaterial" = COALESCE(product."frameMaterial", seed.frame),
  "cushionFilling" = COALESCE(product."cushionFilling", seed.cushion),
  "finish" = COALESCE(product."finish", seed.finish),
  "widthCm" = COALESCE(product."widthCm", seed.width),
  "depthCm" = COALESCE(product."depthCm", seed.depth),
  "heightCm" = COALESCE(product."heightCm", seed.height),
  "seatHeightCm" = COALESCE(product."seatHeightCm", seed.seat_height),
  "seatingCapacity" = COALESCE(product."seatingCapacity", seed.capacity),
  "maxLoadKg" = COALESCE(product."maxLoadKg", seed.max_load)
FROM (VALUES
  ('sofia-three-seat-sofa', 'KS-SOF-SOFIA-3S', 'Performance Linen', 'Kiln-dried Hardwood', 'Foam & Feather Blend', 'Upholstered', 228.0, 98.0, 82.0, 44.0, 3, 350.0),
  ('noor-modular-corner-sofa', 'KS-SEC-NOOR-CORNER', 'Performance Linen', 'Kiln-dried Hardwood', 'Pocket Spring & Foam', 'Upholstered', 294.0, 184.0, 76.0, 42.0, 5, 550.0),
  ('atlas-boucle-lounge-chair', 'KS-CHR-ATLAS-01', 'Bouclé', 'Solid Ash', 'High-resilience Foam', 'Upholstered', 78.0, 80.0, 74.0, 43.0, 1, 140.0),
  ('sienna-oak-dining-table', 'KS-TBL-SIENNA-200', 'None', 'Solid Oak', 'None', 'Oiled', 200.0, 100.0, 76.0, NULL, 8, 120.0),
  ('mira-cane-dining-chair', 'KS-CHR-MIRA-CANE', 'None', 'Rattan / Cane', 'None', 'Natural', 49.0, 54.0, 82.0, 46.0, 1, 120.0),
  ('zeenat-upholstered-bed', 'KS-BED-ZEENAT-QN', 'Linen Blend', 'Engineered Hardwood', 'High-resilience Foam', 'Upholstered', 177.0, 224.0, 118.0, NULL, NULL, 350.0),
  ('oakline-bedside-table', 'KS-STO-OAKLINE-48', 'None', 'Solid Oak', 'None', 'Natural', 48.0, 40.0, 54.0, NULL, NULL, 35.0),
  ('vale-travertine-coffee-table', 'KS-TBL-VALE-120', 'None', 'Stone', 'None', 'Polished Stone', 120.0, 65.0, 36.0, NULL, NULL, 80.0),
  ('reed-media-console', 'KS-STO-REED-180', 'None', 'Solid Oak', 'None', 'Walnut Stain', 180.0, 45.0, 58.0, NULL, NULL, 100.0),
  ('sol-outdoor-lounge-set', 'KS-OUT-SOL-4PC', 'Solution-dyed Outdoor Fabric', 'Aluminum', 'Quick-dry Outdoor Foam', 'Powder-coated', 164.0, 82.0, 74.0, 42.0, 4, 500.0)
) AS seed(handle, sku, upholstery, frame, cushion, finish, width, depth, height, seat_height, capacity, max_load)
WHERE product."handle" = seed.handle;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_sku_key" ON "Product"("sku");
