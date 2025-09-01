jest.mock('../../../src/utils/jwtUtils', () => ({
  generateToken: jest.fn(() => 'mock-token'),
}));

const authService = require('../../../src/services/authService');
const jwtUtils = require('../../../src/utils/jwtUtils');

describe('Auth Service', () => {
  const user = { id: 1, email: 'test@example.com' };

  test('should generate access and refresh tokens', () => {
    const tokens = authService.generateTokens(user);

    expect(tokens).toHaveProperty('accessToken', 'mock-token');
    expect(tokens).toHaveProperty('refreshToken', 'mock-token');
    expect(jwtUtils.generateToken).toHaveBeenCalledTimes(2);
  });
});
