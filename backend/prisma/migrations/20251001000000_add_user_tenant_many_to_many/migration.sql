-- CreateTable
CREATE TABLE "user_tenants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_tenants_user_id_idx" ON "user_tenants"("user_id");

-- CreateIndex
CREATE INDEX "user_tenants_tenant_id_idx" ON "user_tenants"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_tenants_user_id_tenant_id_key" ON "user_tenants"("user_id", "tenant_id");

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tenants" ADD CONSTRAINT "user_tenants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrar dados existentes: criar registros UserTenant para todos os usuários que têm tenantId
INSERT INTO "user_tenants" ("id", "user_id", "tenant_id", "role", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    "id",
    "tenant_id",
    CASE
        WHEN "role" = 'ADMIN' THEN 'ADMIN'
        ELSE 'USER'
    END,
    NOW(),
    NOW()
FROM "users"
WHERE "tenant_id" IS NOT NULL;
