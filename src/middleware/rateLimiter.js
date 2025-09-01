const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  message: 'Too many login attempts. Please try again later.',
  skip: (req) => req.method !== 'POST', // <--- Only count POST requests
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  message: 'Too many password reset attempts. Please try again later.',
});

const resendOTPLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3,
  message: 'Too many OTP resend attempts. Please try again later.',
});

module.exports = { loginLimiter, forgotPasswordLimiter, resendOTPLimiter };
