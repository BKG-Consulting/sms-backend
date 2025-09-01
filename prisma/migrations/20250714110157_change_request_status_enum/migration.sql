/*
  Warnings:

  - The `status` column on the `DocumentChangeRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DocumentChangeRequestStatus" AS ENUM ('UNDER_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED');

-- AlterTable
ALTER TABLE "DocumentChangeRequest" DROP COLUMN "status",
ADD COLUMN     "status" "DocumentChangeRequestStatus" NOT NULL DEFAULT 'UNDER_REVIEW';
