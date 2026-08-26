-- CreateTable categories
CREATE TABLE IF NOT EXISTS "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_key" ON "categories"("name");

-- Seed categories from existing product category names
INSERT INTO "categories" ("id", "name", "created_at", "updated_at")
SELECT gen_random_uuid()::text, d.name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
  SELECT DISTINCT TRIM("category") AS name FROM "products" WHERE TRIM("category") <> ''
) AS d
ON CONFLICT ("name") DO NOTHING;

-- Drop manufacturer from products (safe: column unused going forward)
ALTER TABLE "products" DROP COLUMN IF EXISTS "manufacturer";

-- Migrate inventory_batches unit_price -> purchase_price + selling/validity
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'inventory_batches' AND column_name = 'unit_price'
  ) THEN
    ALTER TABLE "inventory_batches" RENAME COLUMN "unit_price" TO "purchase_price";
  END IF;
END $$;

ALTER TABLE "inventory_batches" ADD COLUMN IF NOT EXISTS "selling_price" DECIMAL(12,2);
ALTER TABLE "inventory_batches" ADD COLUMN IF NOT EXISTS "price_effective_from" DATE;
ALTER TABLE "inventory_batches" ADD COLUMN IF NOT EXISTS "price_effective_until" DATE;

UPDATE "inventory_batches" AS b
SET "selling_price" = COALESCE(b."selling_price", p."price")
FROM "products" AS p
WHERE b."product_id" = p."id" AND b."selling_price" IS NULL;

UPDATE "inventory_batches"
SET "selling_price" = COALESCE("selling_price", "purchase_price")
WHERE "selling_price" IS NULL;

UPDATE "inventory_batches"
SET "price_effective_from" = COALESCE("price_effective_from", ("created_at")::date)
WHERE "price_effective_from" IS NULL;

ALTER TABLE "inventory_batches" ALTER COLUMN "selling_price" SET NOT NULL;
ALTER TABLE "inventory_batches" ALTER COLUMN "price_effective_from" SET NOT NULL;
