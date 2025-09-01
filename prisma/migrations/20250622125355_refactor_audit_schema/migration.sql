/*
  Warnings:

  - You are about to drop the column `teamLeaderId` on the `Audit` table. All the data in the column will be lost.
  - The `criteria` column on the `Audit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `methods` column on the `Audit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `objectives` column on the `Audit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `scope` column on the `Audit` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `AuditAppointment` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `role` to the `AuditTeamMember` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Audit" DROP CONSTRAINT "Audit_teamLeaderId_fkey";

-- DropForeignKey
ALTER TABLE "AuditAppointment" DROP CONSTRAINT "AuditAppointment_auditId_fkey";

-- DropForeignKey
ALTER TABLE "AuditAppointment" DROP CONSTRAINT "AuditAppointment_userId_fkey";

-- DropIndex
DROP INDEX "Audit_teamLeaderId_idx";

-- AlterTable
ALTER TABLE "Audit" DROP COLUMN "teamLeaderId",
DROP COLUMN "criteria",
ADD COLUMN     "criteria" TEXT[],
DROP COLUMN "methods",
ADD COLUMN     "methods" TEXT[],
DROP COLUMN "objectives",
ADD COLUMN     "objectives" TEXT[],
DROP COLUMN "scope",
ADD COLUMN     "scope" TEXT[];

-- AlterTable
ALTER TABLE "AuditTeamMember" ADD COLUMN     "role" TEXT NOT NULL;

-- DropTable
DROP TABLE "AuditAppointment";
