-- CreateEnum
CREATE TYPE "DocumentVersionStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'OBSOLETE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "isRecentlyUpdated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastUpdatedViaChangeRequest" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "DocumentVersion" ADD COLUMN     "status" "DocumentVersionStatus" NOT NULL DEFAULT 'ACTIVE';
