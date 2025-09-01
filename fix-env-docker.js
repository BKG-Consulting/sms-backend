#!/usr/bin/env node

/**
 * Quick fix for .env file to use correct Docker PostgreSQL credentials
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing .env file for Docker PostgreSQL...\n');

const envPath = path.join(__dirname, '.env');

// Correct development environment configuration
const correctEnvContent = `# Development Environment Configuration (Docker PostgreSQL)
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

try {
  // Create backup of current .env
  if (fs.existsSync(envPath)) {
    const backupPath = `${envPath}.backup.${Date.now()}`;
    fs.copyFileSync(envPath, backupPath);
    console.log(`✅ Created backup: ${path.basename(backupPath)}`);
  }

  // Write correct configuration
  fs.writeFileSync(envPath, correctEnvContent);
  console.log('✅ Updated .env file with correct Docker PostgreSQL credentials');
  
  console.log('\n📋 Configuration Details:');
  console.log('🗃️  Database: auth_local');
  console.log('👤 Username: postgres');
  console.log('🔑 Password: postgres');
  console.log('🌐 Host: localhost:5432');
  
  console.log('\n🚀 Next steps:');
  console.log('1. Restart your application: npm start');
  console.log('2. Your app should now connect to Docker PostgreSQL successfully');
  
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
  process.exit(1);
}

console.log('\n✨ .env file fix complete!');


