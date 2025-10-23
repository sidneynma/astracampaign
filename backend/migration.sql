-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('QUOTA_WARNING', 'QUOTA_EXCEEDED', 'SYSTEM_ERROR', 'TENANT_INACTIVE', 'SESSION_FAILED', 'CAMPAIGN_FAILED', 'DATABASE_ERROR', 'API_ERROR', 'BACKUP_FAILED', 'SECURITY_ALERT');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationMethod" AS ENUM ('IN_APP', 'EMAIL', 'WEBHOOK');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_quotas" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "max_users" INTEGER NOT NULL DEFAULT 10,
    "max_contacts" INTEGER NOT NULL DEFAULT 1000,
    "max_campaigns" INTEGER NOT NULL DEFAULT 50,
    "max_connections" INTEGER NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "openai_api_key" TEXT,
    "groq_api_key" TEXT,
    "custom_branding" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL,
    "singleton" BOOLEAN NOT NULL DEFAULT true,
    "waha_host" TEXT NOT NULL DEFAULT '',
    "waha_api_key" TEXT NOT NULL DEFAULT '',
    "evolution_host" TEXT NOT NULL DEFAULT '',
    "evolution_api_key" TEXT NOT NULL DEFAULT '',
    "logo_url" TEXT,
    "favicon_url" TEXT,
    "icon_url" TEXT,
    "company_name" TEXT,
    "page_title" TEXT,
    "primary_color" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "tags" TEXT[],
    "observacoes" TEXT,
    "tenant_id" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_sessions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "config" TEXT,
    "me_id" TEXT,
    "me_push_name" TEXT,
    "me_lid" TEXT,
    "me_jid" TEXT,
    "qr" TEXT,
    "qr_expires_at" TIMESTAMP(3),
    "assigned_worker" TEXT,
    "tenant_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'WAHA',

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "targetTags" TEXT NOT NULL,
    "session_name" TEXT,
    "message_type" TEXT NOT NULL,
    "message_content" TEXT NOT NULL,
    "random_delay" INTEGER NOT NULL,
    "start_immediately" BOOLEAN NOT NULL,
    "scheduled_for" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total_contacts" INTEGER NOT NULL DEFAULT 0,
    "sent_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "tenant_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "session_names" TEXT,
    "created_by" TEXT,
    "created_by_name" TEXT,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_messages" (
    "id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "contact_phone" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "error_message" TEXT,
    "message_id" TEXT,
    "selected_variation" TEXT,
    "tenant_id" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "session_name" TEXT,

    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "tenant_id" TEXT,
    "ultimo_login" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_quotas_tenant_id_key" ON "tenant_quotas"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenant_id_key" ON "tenant_settings"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_singleton_key" ON "global_settings"("singleton");

-- CreateIndex
CREATE INDEX "contacts_tenant_id_idx" ON "contacts"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_name_key" ON "whatsapp_sessions"("name");

-- CreateIndex
CREATE INDEX "whatsapp_sessions_tenant_id_idx" ON "whatsapp_sessions"("tenant_id");

-- CreateIndex
CREATE INDEX "campaigns_tenant_id_idx" ON "campaigns"("tenant_id");

-- CreateIndex
CREATE INDEX "campaign_messages_tenant_id_idx" ON "campaign_messages"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

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
ALTER TABLE "tenant_quotas" ADD CONSTRAINT "tenant_quotas_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_session_name_fkey" FOREIGN KEY ("session_name") REFERENCES "whatsapp_sessions"("name") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

