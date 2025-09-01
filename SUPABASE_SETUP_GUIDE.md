# Supabase PostgreSQL Setup Guide

## Overview
This guide will help you set up Supabase as your PostgreSQL database for the dualdauth application.

## Prerequisites
- Supabase account (free at supabase.com)
- Your current Node.js application with Prisma

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Choose your organization
4. Fill in project details:
   - **Name**: `dualdauth-db` (or your preferred name)
   - **Database Password**: Generate a strong password (save it!)
   - **Region**: Choose closest to your users
5. Click "Create new project"
6. Wait for the project to be created (2-3 minutes)

## Step 2: Get Connection Details

Once your project is ready:

1. Go to **Settings** → **Database**
2. Find the **Connection string** section
3. Copy the **URI** (Direct connection)

It will look like:
```
postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
```

## Step 3: Update Your Environment Variables

Create a `.env` file with your Supabase connection:

```env
# Supabase Database Configuration
DATABASE_URL="postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres"

# Email Configuration (required)
EMAIL=your-email@example.com
EMAIL_PASSWORD=your-email-app-password

# JWT Secrets (32+ characters each)
ACCESS_TOKEN_SECRET=your-access-token-secret-minimum-32-characters
REFRESH_TOKEN_SECRET=your-refresh-token-secret-minimum-32-characters

# Client URL
CLIENT_URL=http://localhost:3000

# Server Configuration
PORT=5000
NODE_ENV=development

# Storage (your existing Cloudinary config)
STORAGE_TYPE=cloudinary
CLOUDINARY_CLOUD_NAME=djchczcjj
CLOUDINARY_API_KEY=528913929211587
CLOUDINARY_API_SECRET=kLa-feaYgKfvfOd3SBl3buhWP9g
```

## Step 4: Run Database Migrations

With your Supabase database connected, run your Prisma migrations:

```bash
# Generate Prisma client
npx prisma generate

# Push your schema to Supabase
npx prisma db push

# Or run migrations if you have them
npx prisma migrate deploy

# Seed your database (optional)
npm run seed
```

## Step 5: Test the Connection

Test your application:

```bash
npm start
```

Your app should now connect to Supabase instead of a local database!

## Production Configuration

For production, use the **Pooling** connection string for better performance:

```env
# Production DATABASE_URL (with connection pooling)
DATABASE_URL="postgresql://postgres.your-project-ref:your-password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

## Advantages of Using Supabase

✅ **Managed PostgreSQL** - No server maintenance  
✅ **Automatic Backups** - Daily backups included  
✅ **Real-time Features** - Built-in real-time subscriptions  
✅ **Scalable** - Easy to upgrade plans  
✅ **Dashboard** - Web interface for database management  
✅ **Free Tier** - 500MB database, 2GB bandwidth  
✅ **Global CDN** - Fast worldwide access  

## Optional: Supabase Additional Features

If you want to use Supabase's additional features (Auth, Storage, etc.), add these to your environment:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Troubleshooting

**Connection Issues:**
- Verify your password is correct
- Check if your IP is allowed (Supabase allows all IPs by default)
- Ensure you're using the correct connection string

**Migration Issues:**
- Make sure your schema is compatible with PostgreSQL
- Check Supabase logs in the dashboard

**Performance:**
- Use pooling connection string for production
- Monitor your database usage in Supabase dashboard

## Next Steps

1. Create your Supabase project
2. Update your `.env` file with the connection string
3. Run `npx prisma db push` to create your tables
4. Start your application with `npm start`
5. Your app is now using Supabase PostgreSQL!

