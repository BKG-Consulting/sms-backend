const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const message = await prisma.message.create({
    data: {
      senderId: 'd6662f4d-60d9-4f2d-a404-a84036ac1023',
      conversationId: 'f0e52378-3716-48a1-8c95-d6fa1020cb63',
      tenantId: '75e7156b-5f4b-438b-818e-9d0addb38f9c',
      subject: 'Test',
      body: 'Test body',
      metadata: {},
    }
  });
  console.log(message);
}

main().catch(e => console.error(e));