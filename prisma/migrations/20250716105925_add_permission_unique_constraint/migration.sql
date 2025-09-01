/*
  Warnings:

  - A unique constraint covering the columns `[module,action]` on the table `Permission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_action_key" ON "Permission"("module", "action");
