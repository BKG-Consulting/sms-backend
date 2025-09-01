#!/bin/bash

# Production deployment script
set -e

echo "🚀 Starting production deployment..."

# Load environment variables
if [ -f .env.prod ]; then
    export $(cat .env.prod | xargs)
else
    echo "❌ .env.prod file not found. Please create it with production environment variables."
    exit 1
fi

# Build and start services
echo "📦 Building and starting services..."
docker-compose -f docker-compose.prod.yml down --remove-orphans
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 30

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T auth-service npx prisma migrate deploy

# Run database seeding (optional)
echo "🌱 Seeding database..."
docker-compose -f docker-compose.prod.yml exec -T auth-service npm run seed

echo "✅ Production deployment completed!"
echo "🌐 Your application should be available at: ${CLIENT_URL}"

# Show running containers
docker-compose -f docker-compose.prod.yml ps
