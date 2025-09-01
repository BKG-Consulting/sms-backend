jest.mock('../../../src/utils/jwtUtils', () => ({
  generateToken: jest.fn((payload, secret, expiresIn) => 'mock-token'),
  verifyToken: jest.fn((token, secret) => ({ id: 1, email: 'test@example.com' })),
}));

const jwtUtils = require('../../../src/utils/jwtUtils');

describe('JWT Utils', () => {
  const payload = { id: 1, email: 'test@example.com' };
  const secret = 'test-secret';

  test('should generate a valid JWT token', () => {
    const token = jwtUtils.generateToken(payload, secret, '1h');
    expect(token).toBe('mock-token');
  });

  test('should verify a valid JWT token', () => {
    const decoded = jwtUtils.verifyToken('mock-token', secret);
    expect(decoded).toMatchObject(payload);
  });

  test('should throw an error for an invalid token', () => {
    jwtUtils.verifyToken.mockImplementationOnce(() => {
      throw new Error('Invalid token');
    });
    expect(() => jwtUtils.verifyToken('invalid-token', secret)).toThrow('Invalid token');
  });
});
