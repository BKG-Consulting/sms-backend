/*
  Warnings:

  - The values [PROCESS,DOCUMENTATION,TRAINING,EQUIPMENT,ENVIRONMENT,OTHER] on the enum `FindingCategory` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `auditPlanId` on the `AuditFinding` table. All the data in the column will be lost.
  - You are about to drop the column `clauseNumber` on the `AuditFinding` table. All the data in the column will be lost.
  - You are about to drop the column `evidence` on the `AuditFinding` table. All the data in the column will be lost.
  - You are about to drop the column `severity` on the `AuditFinding` table. All the data in the column will be lost.
  - The `status` column on the `AuditFinding` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `auditId` to the `AuditFinding` table without a default value. This is not possible if the table is not empty.
  - Added the required column `criteria` to the `AuditFinding` table without a default value. This is not possible if the table is not empty.
  - Made the column `department` on table `AuditFinding` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "FindingApprovalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REFUSED');

-- AlterEnum
BEGIN;
CREATE TYPE "FindingCategory_new" AS ENUM ('COMPLIANCE', 'IMPROVEMENT', 'NON_CONFORMITY');
ALTER TABLE "AuditFinding" ALTER COLUMN "category" TYPE "FindingCategory_new" USING ("category"::text::"FindingCategory_new");
ALTER TYPE "FindingCategory" RENAME TO "FindingCategory_old";
ALTER TYPE "FindingCategory_new" RENAME TO "FindingCategory";
DROP TYPE "FindingCategory_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "AuditFinding" DROP CONSTRAINT "AuditFinding_auditPlanId_fkey";

-- AlterTable
ALTER TABLE "AuditFinding" DROP COLUMN "auditPlanId",
DROP COLUMN "clauseNumber",
DROP COLUMN "evidence",
DROP COLUMN "severity",
ADD COLUMN     "auditId" TEXT NOT NULL,
ADD COLUMN     "criteria" TEXT NOT NULL,
ADD COLUMN     "hodFeedback" TEXT,
ALTER COLUMN "category" DROP NOT NULL,
ALTER COLUMN "department" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "FindingApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "FindingSeverity";

-- DropEnum
DROP TYPE "FindingStatus";

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
