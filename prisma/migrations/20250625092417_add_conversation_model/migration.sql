/*
  Warnings:

  - You are about to drop the column `recipientId` on the `Message` table. All the data in the column will be lost.
  - Added the required column `conversationId` to the `Message` table without a default value. This is not possible if the table is not empty.

*/
-- 1. Add conversationId as nullable
ALTER TABLE "Message" ADD COLUMN "conversationId" TEXT;

-- 2. Create Conversation table
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT,
    "isGroup" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- 3. Insert a default Conversation for each Tenant
INSERT INTO "Conversation" ("id", "tenantId", "isGroup", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "id", false, NOW(), NOW()
FROM "Tenant";

-- 4. Backfill Message.conversationId for all existing messages using tenantId
UPDATE "Message" m
SET "conversationId" = (
  SELECT c."id"
  FROM "Conversation" c
  WHERE c."tenantId" = m."tenantId"
  LIMIT 1
);

-- 5. Now make conversationId NOT NULL
ALTER TABLE "Message" ALTER COLUMN "conversationId" SET NOT NULL;

-- 6. Drop recipientId and its foreign key
ALTER TABLE "Message" DROP CONSTRAINT IF EXISTS "Message_recipientId_fkey";
ALTER TABLE "Message" DROP COLUMN IF EXISTS "recipientId";

-- 7. Continue with the rest of the migration as generated
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Conversation_lastMessageId_key" ON "Conversation"("lastMessageId");
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_lastMessageId_fkey" FOREIGN KEY ("lastMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
