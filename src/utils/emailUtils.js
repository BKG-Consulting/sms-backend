const { transporter } = require('../config/email');
const { prisma } = require('../../prisma/client');
const { logger } = require('../utils/logger');

const sendEmail = async (to, subject, text, html, attempt = 1) => {
  try {
    const info = await transporter.sendMail({
      from: `"Dual Dimension" <${process.env.EMAIL}>`,
      to,
      subject,
      text,
      html,
    });
    logger.info(`Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error(`Failed to send email (Attempt ${attempt})`, {
      error: err.message,
      stack: err.stack,
      to,
    });
    if (attempt < 3) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      return sendEmail(to, subject, text, html, attempt + 1);
    }
    throw new Error('Failed to send email after 3 attempts');
  }
};

const generateOTP = async (email) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  await storeOTP(email, otp, expiresAt);
  return otp;
};

const storeOTP = async (email, otp, expiresAt) => {
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const latestOtp = await prisma.OTP.findFirst({
      where: { email, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (latestOtp) {
      await prisma.OTP.update({
        where: {
          email_createdAt: {
            email,
            createdAt: latestOtp.createdAt,
          },
        },
        data: {
          code: otp,
          expiresAt: new Date(expiresAt),
          verified: false,
          userId: user?.id,
        },
      });
    } else {
      await prisma.OTP.create({
        data: {
          email,
          code: otp,
          expiresAt: new Date(expiresAt),
          verified: false,
          user: user ? { connect: { id: user.id } } : undefined,
        },
      });
    }
    logger.info(`Stored OTP for ${email}: ${otp}, expires at ${new Date(expiresAt)}`);
  } catch (err) {
    logger.error('Failed to store OTP', { error: err.message, stack: err.stack, email });
    throw new Error('Failed to store OTP');
  }
};

const getStoredOTP = async (email) => {
  try {
    const otpRecord = await prisma.OTP.findFirst({
      where: { email, verified: false },
      orderBy: { createdAt: 'desc' },
    });
    if (!otpRecord) {
      logger.info(`No OTP found for ${email}`);
      return null;
    }
    return { storedOtp: otpRecord.code, expiresAt: otpRecord.expiresAt.getTime() };
  } catch (err) {
    logger.error('Failed to retrieve OTP', { error: err.message, stack: err.stack, email });
    throw new Error('Failed to retrieve OTP');
  }
};

const sendOTP = async (email) => {
  try {
    const otp = await generateOTP(email);
    const info = await sendEmail(
      email,
      'Your Verification Code',
      `Your verification code is: ${otp}. It expires in 5 minutes.`,
      `<p>Your verification code is: <strong>${otp}</strong>. It expires in 5 minutes.</p>`
    );
    logger.info(`📩 OTP email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Failed to send OTP email', { error: err.message, stack: err.stack, email });
    throw new Error('Failed to send OTP email');
  }
};

const verifyOTP = async (email, otp) => {
  try {
    const storedData = await getStoredOTP(email);
    if (!storedData) {
      throw new Error('No OTP found for this email');
    }
    const { storedOtp, expiresAt } = storedData;
    if (Date.now() > expiresAt) {
      throw new Error('OTP has expired');
    }
    if (otp !== storedOtp) {
      throw new Error('Invalid OTP');
    }
    await prisma.OTP.updateMany({
      where: { email, code: otp },
      data: { verified: true },
    });
    await prisma.user.update({
      where: { email },
      data: { verified: true },
    });
    logger.info(`✅ OTP verified for ${email}`);
  } catch (err) {
    logger.error('Failed to verify OTP', { error: err.message, stack: err.stack, email });
    throw err;
  }
};

const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    const info = await sendEmail(
      email,
      'Password Reset Link',
      `Click the link to reset your password: ${resetLink}`,
      `<p>Click the link to reset your password: <a href="${resetLink}">${resetLink}</a></p>`
    );
    logger.info(`Password reset email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Failed to send password reset email', { error: err.message, stack: err.stack, email });
    throw new Error('Failed to send password reset email');
  }
};

const sendUserInvitationEmail = async (email, invitationLink, institutionName) => {
  try {
    const info = await sendEmail(
      email,
      `Welcome to ${institutionName} - Complete Your Account Setup`,
      `You've been invited to join ${institutionName}. Click the following link to set up your account: ${invitationLink}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Welcome to ${institutionName}!</h2>
          <p>You've been invited to join our institution's management system.</p>
          <p>Click the button below to set up your account and create your password:</p>
          <a href="${invitationLink}" style="display: inline-block; background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 16px 0;">Set Up Account</a>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${invitationLink}</p>
          <p>This invitation link will expire in 24 hours.</p>
          <p>If you have any questions, please contact your system administrator.</p>
        </div>
      `
    );
    logger.info(`User invitation email sent to ${email}: ${info.messageId}`);
    return info;
  } catch (err) {
    logger.error('Failed to send user invitation email', { error: err.message, stack: err.stack, email });
    throw new Error('Failed to send user invitation email');
  }
};

module.exports = { sendOTP, verifyOTP, sendPasswordResetEmail, sendUserInvitationEmail };