-- CreateEnum
CREATE TYPE "AuditPlanStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FindingCategory" AS ENUM ('COMPLIANCE', 'PROCESS', 'DOCUMENTATION', 'TRAINING', 'EQUIPMENT', 'ENVIRONMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "FindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "FindingStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "NonConformityType" AS ENUM ('MAJOR', 'MINOR', 'OBSERVATION');

-- CreateEnum
CREATE TYPE "NonConformitySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NonConformityStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CorrectiveActionType" AS ENUM ('CORRECTIVE', 'PREVENTIVE', 'IMPROVEMENT');

-- CreateEnum
CREATE TYPE "CorrectiveActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED');

-- CreateTable
CREATE TABLE "AuditPlan" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "objectives" TEXT[],
    "scope" TEXT[],
    "criteria" TEXT[],
    "methods" TEXT[],
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "status" "AuditPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditFinding" (
    "id" TEXT NOT NULL,
    "auditPlanId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "FindingCategory" NOT NULL,
    "severity" "FindingSeverity" NOT NULL,
    "clauseNumber" TEXT,
    "department" TEXT,
    "evidence" TEXT,
    "attachments" TEXT[],
    "status" "FindingStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonConformity" (
    "id" TEXT NOT NULL,
    "auditPlanId" TEXT NOT NULL,
    "findingId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "clauseNumber" TEXT,
    "type" "NonConformityType" NOT NULL,
    "severity" "NonConformitySeverity" NOT NULL,
    "rootCause" TEXT,
    "status" "NonConformityStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL,
    "auditPlanId" TEXT NOT NULL,
    "nonConformityId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionType" "CorrectiveActionType" NOT NULL,
    "priority" "CorrectiveActionPriority" NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'OPEN',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditPlan" ADD CONSTRAINT "AuditPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_auditPlanId_fkey" FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditFinding" ADD CONSTRAINT "AuditFinding_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_auditPlanId_fkey" FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "AuditFinding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_auditPlanId_fkey" FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_nonConformityId_fkey" FOREIGN KEY ("nonConformityId") REFERENCES "NonConformity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
