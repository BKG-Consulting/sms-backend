/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,name]` on the table `Role` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Role_tenantId_name_key" ON "Role"("tenantId", "name");
