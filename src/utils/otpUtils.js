const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Generate OTP and store in the database
const generateOTP = async (email) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Set the expiration to 5 minutes from now
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Save OTP to the database
  await prisma.oTP.create({
    data: {
      email,
      code: otp,
      expiresAt,
    },
  });

  return otp;
};

// Validate OTP from the database
const validateOTP = async (email, otp) => {
  const storedOTP = await prisma.oTP.findFirst({
    where: {
      email,
      verified: false, // Only consider unverified OTPs
      expiresAt: { gt: new Date() }, // Ensure OTP hasn't expired
    },
    orderBy: { createdAt: 'desc' }, // Most recent OTP first
  });

  if (storedOTP && storedOTP.code === otp) {
    // Mark OTP as verified
    await prisma.oTP.update({
      where: { id: storedOTP.id },
      data: { verified: true },
    });
    return true;
  }

  return false;
};

module.exports = { generateOTP, validateOTP };
