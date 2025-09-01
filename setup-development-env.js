#!/usr/bin/env node

/**
 * Development Environment Setup Script
 * Sets up local development with Docker PostgreSQL
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Setting up development environment with Docker PostgreSQL...\n');

// Development environment template
const developmentEnvTemplate = `# Development Environment Configuration (Docker PostgreSQL)
# This file is for development using Docker PostgreSQL

# Database Configuration (Docker PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/auth_local"

# Email Configuration (required by your app)
EMAIL=dev@example.com
EMAIL_PASSWORD=dev-password-change-this

# JWT Secrets (development - use different ones for production)
ACCESS_TOKEN_SECRET=dev-access-token-secret-minimum-32-characters-for-development-env
REFRESH_TOKEN_SECRET=dev-refresh-token-secret-minimum-32-characters-for-development-env

# Client URL (development frontend)
CLIENT_URL=http://localhost:3000

# Server Configuration
PORT=5000
NODE_ENV=development

# Storage Configuration (using your existing Cloudinary)
STORAGE_TYPE=cloudinary
CLOUDINARY_CLOUD_NAME=djchczcjj
CLOUDINARY_API_KEY=528913929211587
CLOUDINARY_API_SECRET=kLa-feaYgKfvfOd3SBl3buhWP9g

# Optional: Document service URL (if using microservices)
# DOCUMENT_SERVICE_URL=http://localhost:5002
`;

const envPath = path.join(__dirname, '.env');

function checkDockerContainers() {
  try {
    console.log('📋 Checking Docker containers...');
    const result = execSync('docker-compose ps --format json', { encoding: 'utf8' });
    const containers = result.trim().split('\n').map(line => JSON.parse(line));
    
    const dbContainer = containers.find(c => c.Service === 'db');
    const authContainer = containers.find(c => c.Service === 'auth-service');
    
    console.log(`Database: ${dbContainer ? '✅ Running' : '❌ Not running'}`);
    console.log(`Auth Service: ${authContainer ? '✅ Running' : '❌ Not running'}`);
    
    if (!dbContainer || dbContainer.State !== 'running') {
      console.log('\n⚠️  Database container is not running. Starting it...');
      execSync('docker-compose up db -d', { stdio: 'inherit' });
      console.log('✅ Database container started');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Error checking Docker containers:', error.message);
    return false;
  }
}

function createEnvFile() {
  try {
    if (fs.existsSync(envPath)) {
      console.log('\n📄 .env file already exists. Creating backup...');
      const backupPath = `${envPath}.backup.${Date.now()}`;
      fs.copyFileSync(envPath, backupPath);
      console.log(`✅ Backup created: ${path.basename(backupPath)}`);
    }
    
    console.log('\n📝 Creating development .env file...');
    fs.writeFileSync(envPath, developmentEnvTemplate);
    console.log('✅ .env file created for development');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    return false;
  }
}

async function testDatabaseConnection() {
  try {
    console.log('\n🔗 Testing database connection...');
    
    // Import and test connection using the new .env
    require('dotenv').config();
    const { prisma } = require('./prisma/client');
    
    await prisma.$connect();
    console.log('✅ Successfully connected to Docker PostgreSQL!');
    
    // Test a simple query
    const result = await prisma.$queryRaw`SELECT version();`;
    console.log(`📊 PostgreSQL Version: ${result[0].version.split(' ')[0]} ${result[0].version.split(' ')[1]}`);
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tips:');
      console.log('- Make sure Docker is running');
      console.log('- Run: docker-compose up db -d');
      console.log('- Check if port 5432 is available');
    }
    
    return false;
  }
}

async function setupDatabase() {
  try {
    console.log('\n🔄 Setting up database schema...');
    
    // Generate Prisma client
    console.log('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });
    
    // Push schema to database (good for development)
    console.log('Pushing schema to database...');
    execSync('npx prisma db push', { stdio: 'inherit' });
    
    console.log('✅ Database schema setup complete!');
    return true;
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    
    console.log('\n💡 You can manually run these commands:');
    console.log('- npx prisma generate');
    console.log('- npx prisma db push');
    console.log('- npm run seed (optional)');
    
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🏗️  DEVELOPMENT ENVIRONMENT SETUP');
  console.log('='.repeat(60));
  
  // Step 1: Check Docker containers
  if (!checkDockerContainers()) {
    console.log('\n❌ Cannot proceed without Docker containers');
    process.exit(1);
  }
  
  // Step 2: Create .env file
  if (!createEnvFile()) {
    console.log('\n❌ Cannot proceed without .env file');
    process.exit(1);
  }
  
  // Wait a moment for containers to be ready
  console.log('\n⏳ Waiting for database to be ready...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 3: Test database connection
  const connectionSuccess = await testDatabaseConnection();
  
  if (connectionSuccess) {
    // Step 4: Setup database schema
    await setupDatabase();
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DEVELOPMENT ENVIRONMENT READY!');
    console.log('='.repeat(60));
    console.log('');
    console.log('📋 What\'s configured:');
    console.log('✅ Docker PostgreSQL database running on localhost:5432');
    console.log('✅ Development .env file created');
    console.log('✅ Database schema synchronized');
    console.log('✅ Prisma client generated');
    console.log('');
    console.log('🚀 Next steps:');
    console.log('1. Run: npm start (to start your backend)');
    console.log('2. Your backend will connect to Docker PostgreSQL');
    console.log('3. Your API will be available at http://localhost:5000');
    console.log('');
    console.log('🔧 Optional:');
    console.log('- Run: npm run seed (to populate with sample data)');
    console.log('- Setup Supabase for production later');
    console.log('');
    console.log('📁 Files created:');
    console.log('- .env (development configuration)');
    console.log('- .env.backup.* (backup of previous .env if existed)');
    
  } else {
    console.log('\n❌ Setup incomplete due to database connection issues');
    console.log('Please check the Docker setup and try again');
  }
}

// Run the setup
main().catch(console.error);


