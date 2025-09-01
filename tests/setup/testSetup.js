const dotenv = require('dotenv');
const path = require('path');

// Load test-specific environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

beforeAll(() => {
  console.log('Setting up test environment...');
});

afterAll(() => {
  console.log('Cleaning up test environment...');
});
