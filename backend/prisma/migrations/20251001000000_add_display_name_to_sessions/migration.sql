-- AlterTable
ALTER TABLE "whatsapp_sessions" ADD COLUMN "display_name" TEXT;

-- Update existing records to have displayName same as name (for backward compatibility)
UPDATE "whatsapp_sessions" SET "display_name" = "name" WHERE "display_name" IS NULL;
