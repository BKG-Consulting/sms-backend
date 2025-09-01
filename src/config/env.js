// src/config/env.js
const { z } = require('zod');

const envSchema = z.object({
  EMAIL: z.string().email(),
  EMAIL_PASSWORD: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().url().optional(), // Make DATABASE_URL explicit (Prisma handles fallback)
  DOCUMENT_SERVICE_URL: z.string().url().optional(),
  PORT: z.string().default('5000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // Optional Supabase-specific configurations
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const env = envSchema.parse(process.env);

module.exports = env;