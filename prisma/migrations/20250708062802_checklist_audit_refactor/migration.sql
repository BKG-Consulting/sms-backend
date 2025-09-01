/*
  Warnings:

  - You are about to drop the column `auditPlanId` on the `Checklist` table. All the data in the column will be lost.
  - Added the required column `auditId` to the `Checklist` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Checklist" DROP CONSTRAINT "Checklist_auditPlanId_fkey";

-- DropIndex
DROP INDEX "Checklist_auditPlanId_idx";

-- DropIndex
DROP INDEX "Checklist_type_idx";

-- AlterTable
ALTER TABLE "Checklist" DROP COLUMN "auditPlanId",
ADD COLUMN     "auditId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
