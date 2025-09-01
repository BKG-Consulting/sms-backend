const dotenv = require('dotenv');
const path = require('path');

// Load the .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('Environment Variables Validation', () => {
  const requiredEnvVars = [
    'DATABASE_URL',
    
    'EMAIL',
    'EMAIL_PASSWORD',
    'ACCESS_TOKEN_SECRET',
    'REFRESH_TOKEN_SECRET',
    'CLIENT_URL',
    'TENANT_SERVICE_URL',
  ];

  test('should have all required environment variables defined and non-empty', () => {
    requiredEnvVars.forEach((key) => {
      expect(process.env[key]).toBeDefined();
      expect(process.env[key]).not.toBe('');
    });
  });
});
