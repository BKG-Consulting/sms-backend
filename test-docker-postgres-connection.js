// Test Docker PostgreSQL connection
require('dotenv').config();
const { prisma } = require('./prisma/client');

async function testDockerPostgresConnection() {
  try {
    console.log('🔗 Testing Docker PostgreSQL connection...');
    console.log('Database URL:', process.env.DATABASE_URL ? 'Set ✅' : 'Not set ❌');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Connected to Docker PostgreSQL successfully!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version();`;
    console.log('📊 PostgreSQL Version:', result[0].version);
    
    // Check if we're connecting to the right database
    const dbInfo = await prisma.$queryRaw`SELECT current_database() as db_name;`;
    console.log('🗃️  Connected to database:', dbInfo[0].db_name);
    
    // Test if tables exist
    try {
      const userCount = await prisma.user.count();
      console.log(`👥 Users in database: ${userCount}`);
    } catch (error) {
      console.log('⚠️  Tables not yet created. Run: npx prisma db push');
    }
    
    // Test Docker container info
    try {
      const containerInfo = await prisma.$queryRaw`
        SELECT 
          current_setting('server_version') as postgres_version,
          current_setting('port') as port,
          current_setting('shared_preload_libraries') as extensions
      `;
      console.log('🐳 Docker PostgreSQL Info:');
      console.log('   Version:', containerInfo[0].postgres_version);
      console.log('   Port:', containerInfo[0].port);
    } catch (error) {
      console.log('📋 Container info not available');
    }
    
    // Test if we can perform basic operations
    try {
      await prisma.$queryRaw`SELECT NOW() as current_time;`;
      console.log('⏰ Database is responsive and ready');
    } catch (error) {
      console.log('❌ Database query failed:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Docker PostgreSQL connection failed:');
    console.error('Error:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tips:');
      console.log('- Make sure Docker is running: docker --version');
      console.log('- Start the database: docker-compose up db -d');
      console.log('- Check container status: docker-compose ps');
      console.log('- Verify port 5432 is available: netstat -an | findstr 5432');
    }
    
    if (error.message.includes('password authentication failed')) {
      console.log('\n💡 Tips:');
      console.log('- Check your DATABASE_URL credentials');
      console.log('- Verify Docker compose database settings');
      console.log('- Try: docker-compose logs db');
    }
    
    if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n💡 Tips:');
      console.log('- Database might not be created yet');
      console.log('- Check docker-compose.yml POSTGRES_DB setting');
      console.log('- Try: docker-compose restart db');
    }
    
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Disconnected from database');
  }
}

// Run the test
testDockerPostgresConnection()
  .catch(console.error)
  .finally(() => process.exit(0));


