/*
  Warnings:

  - Made the column `department` on table `AuditAnalysis` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "AuditAnalysis" ALTER COLUMN "department" SET NOT NULL,
ALTER COLUMN "department" SET DEFAULT '';
