-- AddColumn session_names to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "session_names" TEXT;

-- AddColumn created_by and created_by_name to campaigns
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_by_name" TEXT;

-- AddColumn session_name field to campaign_messages
ALTER TABLE "campaign_messages" ADD COLUMN IF NOT EXISTS "session_name" TEXT;

-- AddColumn openai_api_key to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "openai_api_key" TEXT;

-- AddColumn groq_api_key to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "groq_api_key" TEXT;

-- AddColumn favicon_url to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "favicon_url" TEXT;

-- AddColumn page_title to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "page_title" TEXT;

-- AddColumn icon_url to settings
ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "icon_url" TEXT;

-- Update default values to use environment variables (will be handled by application)
-- Remove hardcoded URLs from database defaults
ALTER TABLE "settings" ALTER COLUMN "waha_host" DROP DEFAULT;
ALTER TABLE "settings" ALTER COLUMN "waha_api_key" DROP DEFAULT;
ALTER TABLE "settings" ALTER COLUMN "waha_host" SET DEFAULT '';
ALTER TABLE "settings" ALTER COLUMN "waha_api_key" SET DEFAULT '';

-- AddForeignKey for created_by (optional, can be null)
-- Note: This will be handled by Prisma relations when we re-enable them