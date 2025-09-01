-- CreateEnum
CREATE TYPE "AuditProgramStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AuditType" AS ENUM ('FIRST_INTERNAL', 'FIRST_SURVEILLANCE', 'SECOND_INTERNAL', 'SECOND_SURVEILLANCE', 'THIRD_INTERNAL', 'RECERTIFICATION');

-- CreateEnum
CREATE TYPE "AuditStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AuditProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "status" "AuditProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "committedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Audit" (
    "id" TEXT NOT NULL,
    "auditProgramId" TEXT NOT NULL,
    "auditNo" INTEGER NOT NULL,
    "type" "AuditType" NOT NULL,
    "objectiveScopeCriteriaMethods" TEXT,
    "auditDateFrom" TIMESTAMP(3),
    "auditDateTo" TIMESTAMP(3),
    "teamLeaderAppointmentDate" TIMESTAMP(3),
    "teamMemberAppointmentDate" TIMESTAMP(3),
    "teamLeaderId" TEXT,
    "followUpDateFrom" TIMESTAMP(3),
    "followUpDateTo" TIMESTAMP(3),
    "managementReviewDateFrom" TIMESTAMP(3),
    "managementReviewDateTo" TIMESTAMP(3),
    "status" "AuditStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditTeamMember" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "appointedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditAppointment" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'TEAM_MEMBER',
    "appointedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditAppointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditProgram_tenantId_idx" ON "AuditProgram"("tenantId");

-- CreateIndex
CREATE INDEX "AuditProgram_createdById_idx" ON "AuditProgram"("createdById");

-- CreateIndex
CREATE INDEX "Audit_auditProgramId_idx" ON "Audit"("auditProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "Audit_auditProgramId_auditNo_key" ON "Audit"("auditProgramId", "auditNo");

-- CreateIndex
CREATE INDEX "AuditTeamMember_auditId_idx" ON "AuditTeamMember"("auditId");

-- CreateIndex
CREATE INDEX "AuditTeamMember_userId_idx" ON "AuditTeamMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditTeamMember_auditId_userId_key" ON "AuditTeamMember"("auditId", "userId");

-- CreateIndex
CREATE INDEX "AuditAppointment_auditId_idx" ON "AuditAppointment"("auditId");

-- CreateIndex
CREATE INDEX "AuditAppointment_userId_idx" ON "AuditAppointment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditAppointment_auditId_userId_role_key" ON "AuditAppointment"("auditId", "userId", "role");

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditProgram" ADD CONSTRAINT "AuditProgram_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_auditProgramId_fkey" FOREIGN KEY ("auditProgramId") REFERENCES "AuditProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Audit" ADD CONSTRAINT "Audit_teamLeaderId_fkey" FOREIGN KEY ("teamLeaderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditTeamMember" ADD CONSTRAINT "AuditTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAppointment" ADD CONSTRAINT "AuditAppointment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditAppointment" ADD CONSTRAINT "AuditAppointment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
