process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1'; // Silence KafkaJS partitioner warning

const request = require('supertest');
const app = require('../../src/index'); // Ensure this points to the correct app entry point
const { connectDB, disconnectDB } = require('../../src/services/db');

beforeAll(async () => {
  await connectDB(); // Ensure DB connection is established before tests
  // Ensure Kafka producer is connected if used in tests
  const { producer } = require('../../src/events/kafkaProducer');
  await producer.connect();
});

afterAll(async () => {
  // Ensure Kafka producer is disconnected
  const { producer } = require('../../src/events/kafkaProducer');
  await producer.disconnect();
  await disconnectDB(); // Ensure DB connection is closed after tests
});

describe('Auth Endpoints', () => {
  test('POST /login should return 200 and tokens for valid credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('refreshToken');
  });

  test('POST /login should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(response.status).toBe(401);
  });
});
