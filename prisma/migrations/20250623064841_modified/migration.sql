-- CreateEnum
CREATE TYPE "TeamMemberStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "AuditTeamMember" ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "responseAt" TIMESTAMP(3),
ADD COLUMN     "status" "TeamMemberStatus" NOT NULL DEFAULT 'PENDING';
