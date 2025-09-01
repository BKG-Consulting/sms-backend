-- CreateTable
CREATE TABLE "ChecklistAssignee" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistAssignee_userId_idx" ON "ChecklistAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistAssignee_checklistId_userId_key" ON "ChecklistAssignee"("checklistId", "userId");

-- AddForeignKey
ALTER TABLE "ChecklistAssignee" ADD CONSTRAINT "ChecklistAssignee_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistAssignee" ADD CONSTRAINT "ChecklistAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
