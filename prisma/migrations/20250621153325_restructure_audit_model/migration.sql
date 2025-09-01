/*
  Warnings:

  - You are about to drop the column `objectiveScopeCriteriaMethods` on the `Audit` table. All the data in the column will be lost.
  - Added the required column `criteria` to the `Audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `methods` to the `Audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `objectives` to the `Audit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scope` to the `Audit` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Audit" DROP COLUMN "objectiveScopeCriteriaMethods",
ADD COLUMN     "criteria" TEXT NOT NULL,
ADD COLUMN     "methods" TEXT NOT NULL,
ADD COLUMN     "objectives" TEXT NOT NULL,
ADD COLUMN     "scope" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Audit_teamLeaderId_idx" ON "Audit"("teamLeaderId");

-- CreateIndex
CREATE INDEX "Audit_status_idx" ON "Audit"("status");
