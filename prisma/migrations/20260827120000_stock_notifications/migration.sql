-- CreateTable
CREATE TABLE "stock_notifications" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "quantity_change" INTEGER,
    "quantity_before" INTEGER,
    "quantity_after" INTEGER,
    "batch_no" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_notification_reads" (
    "id" TEXT NOT NULL,
    "notification_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_notification_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_notifications_created_at_idx" ON "stock_notifications"("created_at");

-- CreateIndex
CREATE INDEX "stock_notification_reads_user_id_idx" ON "stock_notification_reads"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_notification_reads_notification_id_user_id_key" ON "stock_notification_reads"("notification_id", "user_id");

-- AddForeignKey
ALTER TABLE "stock_notification_reads" ADD CONSTRAINT "stock_notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "stock_notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_notification_reads" ADD CONSTRAINT "stock_notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
