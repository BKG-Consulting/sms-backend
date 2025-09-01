/*
  Warnings:

  - A unique constraint covering the columns `[auditId]` on the table `AuditPlan` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AuditPlan_auditId_key" ON "AuditPlan"("auditId");
