-- CreateTable
CREATE TABLE "AgendaTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "tenantId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "agendaText" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaTemplateItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgendaTemplate" ADD CONSTRAINT "AgendaTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaTemplateItem" ADD CONSTRAINT "AgendaTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AgendaTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
