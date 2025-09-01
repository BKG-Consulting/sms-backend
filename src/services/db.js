const { prisma } = require('../../prisma/client');

const connectDB = async () => {
  try {
    // Ensure the database URL is correctly set for local testing or Docker
    const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost:5432/auth';
    console.log(`Connecting to database at ${dbUrl}`);
    await prisma.$connect();
    console.log('Connected to the database');
  } catch (err) {
    console.error('Error connecting to the database', err);
    process.exit(1); // Exit process if DB connection fails
  }
};

const disconnectDB = async () => {
  try {
    await prisma.$disconnect();
    console.log('Disconnected from the database');
  } catch (err) {
    console.error('Error disconnecting from the database', err);
  }
};

module.exports = { connectDB, disconnectDB };
