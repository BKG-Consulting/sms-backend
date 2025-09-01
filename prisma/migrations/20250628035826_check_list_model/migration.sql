-- CreateEnum
CREATE TYPE "ChecklistType" AS ENUM ('PRE_AUDIT', 'DURING_AUDIT', 'POST_AUDIT', 'COMPLIANCE', 'DEPARTMENT_SPECIFIC', 'ISO_CLAUSE', 'GENERAL');

-- CreateEnum
CREATE TYPE "ChecklistStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Checklist" (
    "id" TEXT NOT NULL,
    "auditPlanId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChecklistType" NOT NULL,
    "department" TEXT,
    "status" "ChecklistStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "completedById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "clauseNumber" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "evidence" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Checklist_auditPlanId_idx" ON "Checklist"("auditPlanId");

-- CreateIndex
CREATE INDEX "Checklist_type_idx" ON "Checklist"("type");

-- CreateIndex
CREATE INDEX "ChecklistItem_checklistId_idx" ON "ChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "ChecklistItem_completed_idx" ON "ChecklistItem"("completed");

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_auditPlanId_fkey" FOREIGN KEY ("auditPlanId") REFERENCES "AuditPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
