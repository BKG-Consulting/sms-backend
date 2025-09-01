require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resyncUsers() {
  console.log('Starting user resynchronization...');

  try {
    const users = await prisma.user.findMany({
      include: { userRoles: { select: { roleId: true } } },
    });

    for (const user of users) {
      const roleIds = user.userRoles.map((ur) => ur.roleId);

      try {
        await axios.post(`${process.env.DOCUMENT_SERVICE_URL || 'http://document-service:5002'}/api/sync`, {
          id: user.id,
          email: user.email,
          tenantId: user.tenantId,
          roleIds,
          departmentId: user.departmentId,
        });
        console.log(`User ${user.id} synchronized successfully`);
      } catch (syncError) {
        console.error(`Failed to synchronize user ${user.id}:`, syncError.message);
      }
    }
  } catch (error) {
    console.error('Error during user resynchronization:', error.message);
  } finally {
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  }
}

resyncUsers();
