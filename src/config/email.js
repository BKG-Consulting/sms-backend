const nodemailer = require('nodemailer');
const env  = require('./env');
const { logger } = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: 'smtpout.secureserver.net',
  port: 587,
  secure: false, // Use STARTTLS
  auth: {
    user: env.EMAIL,
    pass: env.EMAIL_PASSWORD,
  },
  debug: process.env.NODE_ENV !== 'production', // Enable debug logs in non-production
  logger: true, // Log SMTP interactions
});

transporter.verify((error, success) => {
  if (error) {
    logger.error('Email transporter verification failed', { error: error.message });
  } else {
    logger.info('Email transporter is ready');
  }
});

module.exports = { transporter };