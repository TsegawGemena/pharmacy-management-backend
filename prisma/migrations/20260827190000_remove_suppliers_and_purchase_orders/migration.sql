-- Drop purchase order / supplier feature (manual restock workflow)

DROP TABLE IF EXISTS "purchase_order_items";
DROP TABLE IF EXISTS "purchase_orders";
DROP TABLE IF EXISTS "suppliers";

DROP TYPE IF EXISTS "PurchaseOrderStatus";
DROP TYPE IF EXISTS "SupplierStatus";
