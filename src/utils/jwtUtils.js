const jwt = require('jsonwebtoken');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const { logger } = require('../utils/logger');

const generateAccessToken = (payload, secret, expiresIn = '1d') => {
  return jwt.sign(payload, secret, { expiresIn });
};

const generateRefreshToken = async (payload, secret, expiresIn = '7d') => {
  let token;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      token = jwt.sign(payload, secret, { expiresIn });
      await refreshTokenRepository.createRefreshToken({
        token,
        userId: payload.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      logger.info('Refresh token created successfully', { userId: payload.userId });
      return token;
    } catch (error) {
      if (error.code === 'P2002' && error.meta?.target?.includes('token')) {
        attempts++;
        logger.warn('Duplicate refresh token detected, retrying', { attempt: attempts + 1 });
        if (attempts >= maxAttempts) {
          logger.error('Failed to generate unique refresh token after multiple attempts');
          throw new Error('Failed to generate unique refresh token after multiple attempts');
        }
        continue;
      }
      logger.error('Error generating refresh token', { error: error.message });
      throw error;
    }
  }
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    logger.error('Token verification failed', { error: error.message });
    throw error;
  }
};

module.exports = { generateAccessToken, generateRefreshToken, verifyToken };