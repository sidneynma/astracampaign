-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "email" TEXT,
    "tags" TEXT[],
    "observacoes" TEXT,
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
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "targetTags" TEXT NOT NULL,
    "session_name" TEXT NOT NULL,
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
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

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
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "waha_host" TEXT NOT NULL DEFAULT 'https://waha.trecofantastico.com.br',
    "waha_api_key" TEXT NOT NULL DEFAULT '7cf698ac74c6bc3cb3fe34a3131a3927',
    "logo_url" TEXT,
    "company_name" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_sessions_name_key" ON "whatsapp_sessions"("name");

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_session_name_fkey" FOREIGN KEY ("session_name") REFERENCES "whatsapp_sessions"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_messages" ADD CONSTRAINT "campaign_messages_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
