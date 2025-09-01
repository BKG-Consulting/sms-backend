-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "defaultContext" TEXT NOT NULL DEFAULT 'dashboard',
ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isRemovable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "loginDestination" TEXT NOT NULL DEFAULT '/dashboard';
