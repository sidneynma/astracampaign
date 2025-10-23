-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "categoria_id" TEXT;

-- CreateIndex
CREATE INDEX "contacts_categoria_id_idx" ON "contacts"("categoria_id");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;