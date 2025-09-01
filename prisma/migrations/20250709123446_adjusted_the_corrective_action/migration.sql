/*
  Warnings:

  - You are about to drop the column `auditPlanId` on the `CorrectiveAction` table. All the data in the column will be lost.
  - You are about to drop the column `auditPlanId` on the `NonConformity` table. All the data in the column will be lost.
  - Made the column `nonConformityId` on table `CorrectiveAction` required. This step will fail if there are existing NULL values in that column.
  - Made the column `findingId` on table `NonConformity` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "CorrectiveAction" DROP CONSTRAINT "CorrectiveAction_auditPlanId_fkey";

-- DropForeignKey
ALTER TABLE "CorrectiveAction" DROP CONSTRAINT "CorrectiveAction_nonConformityId_fkey";

-- DropForeignKey
ALTER TABLE "NonConformity" DROP CONSTRAINT "NonConformity_auditPlanId_fkey";

-- DropForeignKey
ALTER TABLE "NonConformity" DROP CONSTRAINT "NonConformity_findingId_fkey";

-- AlterTable
ALTER TABLE "CorrectiveAction" DROP COLUMN "auditPlanId",
ADD COLUMN     "correctionRequirement" JSONB,
ADD COLUMN     "proposedAction" JSONB,
ALTER COLUMN "nonConformityId" SET NOT NULL;

-- AlterTable
ALTER TABLE "NonConformity" DROP COLUMN "auditPlanId",
ALTER COLUMN "findingId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_nonConformityId_fkey" FOREIGN KEY ("nonConformityId") REFERENCES "NonConformity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
