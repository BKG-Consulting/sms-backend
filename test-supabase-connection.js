// Test Supabase PostgreSQL connection
require('dotenv').config();
const { prisma } = require('./prisma/client');

async function testSupabaseConnection() {
  try {
    console.log('🔗 Testing Supabase connection...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Not set ❌');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Connected to Supabase successfully!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version();`;
    console.log('📊 PostgreSQL Version:', result[0].version);
    
    // Test if tables exist (check for User table from your schema)
    try {
      const userCount = await prisma.user.count();
      console.log(`👥 Users in database: ${userCount}`);
    } catch (error) {
      console.log('⚠️  Tables not yet created. Run: npx prisma db push');
    }
    
    // Test if we can perform basic operations
    try {
      await prisma.$queryRaw`SELECT NOW() as current_time;`;
      console.log('⏰ Database is responsive');
    } catch (error) {
      console.log('❌ Database query failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Supabase connection failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.log('\n💡 Tips:');
      console.log('- Check your DATABASE_URL password');
      console.log('- Verify the connection string from Supabase dashboard');
    }
    
    if (error.message.includes('getaddrinfo ENOTFOUND')) {
      console.log('\n💡 Tips:');
      console.log('- Check your internet connection');
      console.log('- Verify the Supabase project URL is correct');
    }
    
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testSupabaseConnection()
  .catch(console.error)
  .finally(() => process.exit(0));

