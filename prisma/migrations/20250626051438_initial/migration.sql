/*
  Warnings:

  - You are about to drop the column `conversationId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ConversationParticipant` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_lastMessageId_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationParticipant" DROP CONSTRAINT "ConversationParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "conversationId",
ADD COLUMN     "recipientId" TEXT;

-- DropTable
DROP TABLE "Conversation";

-- DropTable
DROP TABLE "ConversationParticipant";

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
