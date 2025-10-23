-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('QUOTA_WARNING', 'QUOTA_EXCEEDED', 'SYSTEM_ERROR', 'TENANT_INACTIVE', 'SESSION_FAILED', 'CAMPAIGN_FAILED', 'DATABASE_ERROR', 'API_ERROR', 'BACKUP_FAILED', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationMethod" AS ENUM ('IN_APP', 'EMAIL', 'WEBHOOK');

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "metadata" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "method" "NotificationMethod" NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sent_at" TIMESTAMP(3),
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerts_tenant_id_idx" ON "alerts"("tenant_id");

-- CreateIndex
CREATE INDEX "alerts_type_severity_idx" ON "alerts"("type", "severity");

-- CreateIndex
CREATE INDEX "alerts_resolved_created_at_idx" ON "alerts"("resolved", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "notifications_alert_id_idx" ON "notifications"("alert_id");

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;