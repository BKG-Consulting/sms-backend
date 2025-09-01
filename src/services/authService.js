const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const refreshTokenRepository = require('../repositories/refreshTokenRepository');
const sessionService = require('./sessionService');
const securityService = require('./securityService');
const { sendOTP, sendPasswordResetEmail } = require('../utils/emailUtils');
const { generateAccessToken, generateRefreshToken, verifyToken } = require('../utils/jwtUtils');
const { verifyOTP } = require('../utils/emailUtils');
const { logger } = require('../utils/logger');
const { prisma } = require('../../prisma/client');

const isStrongPassword = (password) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(password);
};

const authService = {
  registerUser: async ({ email, password, firstName, lastName, tenantId, roleIds, departmentId, tenantName, createdBy }) => {
    if (!isStrongPassword(password)) {
      throw new Error('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
    }
    const existingUser = await userRepository.findUserByEmail(email);
    if (existingUser) {
      throw new Error('Email already registered');
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await userRepository.createUser({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      tenantId,
      verified: true, // DEV: set to true for development. Revert to false for production.
      createdBy,
    });

    // Assign roles if provided
    if (roleIds && roleIds.length) {
      await prisma.userRole.createMany({
        data: roleIds.map(roleId => ({
          userId: user.id,
          roleId,
        })),
      });
    }

    // await sendOTP(email); // DEV: skip OTP for now
    return user;
  },

  loginUser: async (email, password, ipAddress, userAgent) => {
    try {
      // Check IP rate limiting first
      const ipRateLimit = await securityService.checkIPRateLimit(ipAddress);
      if (ipRateLimit.isRateLimited) {
        const err = new Error('Too many login attempts from this IP address. Please try again later.');
        err.code = 'RATE_LIMITED';
        throw err;
      }

      // Check account lockout
      const lockoutStatus = await securityService.checkAccountLockout(email, ipAddress);
      if (lockoutStatus.isLocked) {
        throw new Error(`Account temporarily locked. Please try again in ${Math.ceil(lockoutStatus.remainingSeconds / 60)} minutes.`);
      }

      const user = await userRepository.findUserByEmail(email, {
        include: {
          userDepartmentRoles: {
            include: {
              department: { select: { id: true, name: true } },
              role: { select: { id: true, name: true, loginDestination: true } },
            },
          },
          userRoles: { include: { role: { select: { id: true, name: true, loginDestination: true } } } },
          tenant: { select: { name: true, status: true, logoUrl: true } },
        },
      });

      if (!user) {
        await securityService.trackLoginAttempt(email, ipAddress, userAgent, false);
        throw new Error('User not found');
      }

      if (!user.verified) {
        await securityService.trackLoginAttempt(email, ipAddress, userAgent, false, user.id);
        // Send OTP asynchronously (do not block login response)
        sendOTP(email).catch(e => logger.error('Failed to send OTP email', { email, error: e.message }));
        return {
          requiresVerification: true,
          message: 'Email not verified. A new OTP has been sent to your email.',
        };
      }

      if (!user.password) {
        await securityService.trackLoginAttempt(email, ipAddress, userAgent, false, user.id);
        throw new Error('User record is missing a password');
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        await securityService.trackLoginAttempt(email, ipAddress, userAgent, false, user.id);
        throw new Error('Invalid credentials');
      }

      // Check session limits
      const sessionLimit = await sessionService.checkSessionLimit(user.id);
      if (!sessionLimit.withinLimit) {
        logger.warn('User has too many active sessions', { 
          userId: user.id, 
          currentCount: sessionLimit.currentCount,
          maxAllowed: sessionLimit.maxAllowed 
        });
        // Optionally deactivate oldest sessions or warn user
      }

      // Clear failed attempts after successful login
      await securityService.clearFailedAttempts(email);

      // Track successful login
      // (Consider moving this to a background job/queue for high-traffic systems)
      await securityService.trackLoginAttempt(email, ipAddress, userAgent, true, user.id);

      // Determine primary department/role
      const userDepartmentRoles = user.userDepartmentRoles || [];
      const primaryDR = userDepartmentRoles.find(udr => udr.isPrimaryDepartment || udr.isPrimaryRole) || userDepartmentRoles[0];
      const primaryDepartment = primaryDR?.department ? { id: primaryDR.department.id, name: primaryDR.department.name } : null;
      const primaryRole = primaryDR?.role ? { id: primaryDR.role.id, name: primaryDR.role.name } : null;
      
      // Build roles array with department context
      const roles = userDepartmentRoles.map(udr => ({
        id: udr.role?.id,
        name: udr.role?.name,
        type: udr.department ? 'department' : 'global',
        department: udr.department ? { id: udr.department.id, name: udr.department.name } : null,
        isPrimaryDepartment: udr.isPrimaryDepartment,
        isPrimaryRole: udr.isPrimaryRole,
      }));
      
      // Build departments array
      const departments = userDepartmentRoles
        .filter(udr => udr.department)
        .map(udr => ({ id: udr.department.id, name: udr.department.name }));
      // Build userRoles array (global roles)
      let userRoles = [];
      if (user.userRoles && user.userRoles.length > 0) {
        if (user.userRoles[0].role) {
          userRoles = user.userRoles.map(ur => ({
            id: ur.role.id,
            name: ur.role.name,
            loginDestination: ur.role.loginDestination,
            isDefault: ur.isDefault,
          }));
        } else {
          userRoles = user.userRoles.map(ur => ({
            id: ur.id,
            name: ur.name,
            isDefault: ur.isDefault,
          }));
        }
      }
      // Determine defaultRole from userRoles
      let defaultRole = null;
      if (userRoles.length > 0) {
        defaultRole = userRoles.find(r => r.isDefault) || userRoles[0];
      }
      console.log('DEBUG userRoles for JWT:', userRoles);
      const accessToken = generateAccessToken(
        {
          userId: user.id,
          tenantId: user.tenantId,
          roles,
          userRoles, // always included, even if empty
          departments,
          primaryDepartment,
          primaryRole,
          defaultRole, // <-- ensure this is included in the JWT payload
        },
        process.env.ACCESS_TOKEN_SECRET,
        '4h' // Extended to 4 hours for better user experience
      );
      const refreshToken = await generateRefreshToken(
        { userId: user.id },
        process.env.REFRESH_TOKEN_SECRET
      );
      // Create session
      const deviceInfo = {
        userAgent: userAgent,
        timestamp: new Date().toISOString(),
      };
      await sessionService.createSession(user.id, accessToken, deviceInfo, ipAddress, userAgent);
      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          departmentRoles: (user.userDepartmentRoles || []).map(udr => ({
            id: udr.id,
            department: udr.department ? { id: udr.department.id, name: udr.department.name } : null,
            role: udr.role ? { id: udr.role.id, name: udr.role.name } : null,
            isPrimaryDepartment: udr.isPrimaryDepartment,
            isPrimaryRole: udr.isPrimaryRole,
          })),
          primaryDepartment,
          primaryRole,
          roles,
          departments,
          tenantId: user.tenantId,
          tenantName: user.tenant?.name || null,
          tenantLogoUrl: user.tenant?.logoUrl || null, // Add logo URL for frontend
          firstName: user.firstName,
          lastName: user.lastName,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          userRoles, // include userRoles in user object
          defaultRole, // include defaultRole in user object
        },
        sessionInfo: {
          currentSessions: sessionLimit.currentCount,
          maxSessions: sessionLimit.maxAllowed,
        },
      };
    } catch (error) {
      logger.error('Login failed', { email, ipAddress, error: error.message });
      throw error;
    }
  },

  refreshAccessToken: async (refreshToken) => {
    const tokenRecord = await refreshTokenRepository.findRefreshToken(refreshToken);
    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      throw new Error('Invalid or expired refresh token');
    }
    const payload = verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    // Get user info with the same structure as loginUser
    const user = await userRepository.findUserById(payload.userId, {
      include: {
        userDepartmentRoles: {
          include: {
            department: { select: { id: true, name: true } },
            role: { select: { id: true, name: true, loginDestination: true } },
          },
        },
        userRoles: { include: { role: { select: { id: true, name: true, loginDestination: true } } } },
        tenant: { select: { name: true, status: true, logoUrl: true } },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Determine primary department/role (same logic as loginUser)
    const userDepartmentRoles = user.userDepartmentRoles || [];
    const primaryDR = userDepartmentRoles.find(udr => udr.isPrimaryDepartment || udr.isPrimaryRole) || userDepartmentRoles[0];
    const primaryDepartment = primaryDR?.department ? { id: primaryDR.department.id, name: primaryDR.department.name } : null;
    const primaryRole = primaryDR?.role ? { id: primaryDR.role.id, name: primaryDR.role.name } : null;
    
    // Build roles array with department context
    const roles = userDepartmentRoles.map(udr => ({
      id: udr.role?.id,
      name: udr.role?.name,
      type: udr.department ? 'department' : 'global',
      department: udr.department ? { id: udr.department.id, name: udr.department.name } : null,
      isPrimaryDepartment: udr.isPrimaryDepartment,
      isPrimaryRole: udr.isPrimaryRole,
    }));
    
    // Build departments array
    const departments = userDepartmentRoles
      .filter(udr => udr.department)
      .map(udr => ({ id: udr.department.id, name: udr.department.name }));

    // Build userRoles array (global roles)
    let userRoles = [];
    if (user.userRoles && user.userRoles.length > 0) {
      if (user.userRoles[0].role) {
        userRoles = user.userRoles.map(ur => ({
          id: ur.role.id,
          name: ur.role.name,
          loginDestination: ur.role.loginDestination,
          isDefault: ur.isDefault,
        }));
      } else {
        userRoles = user.userRoles.map(ur => ({
          id: ur.id,
          name: ur.name,
          isDefault: ur.isDefault,
        }));
      }
    }

    // Determine defaultRole from userRoles
    let defaultRole = null;
    if (userRoles.length > 0) {
      defaultRole = userRoles.find(r => r.isDefault) || userRoles[0];
    }

    // Generate new token with the same structure as loginUser
    const accessToken = generateAccessToken(
      {
        userId: payload.userId,
        tenantId: user.tenantId,
        roles,
        userRoles,
        departments,
        primaryDepartment,
        primaryRole,
        defaultRole,
      },
      process.env.ACCESS_TOKEN_SECRET,
      '4h'
    );
    
    await refreshTokenRepository.deleteRefreshToken(refreshToken);
    const newRefreshToken = await generateRefreshToken(
      { userId: payload.userId },
      process.env.REFRESH_TOKEN_SECRET
    );
    return { accessToken, newRefreshToken };
  },

  deleteRefreshToken: async (refreshToken) => {
    await refreshTokenRepository.deleteRefreshToken(refreshToken);
  },

  logoutUser: async (accessToken) => {
    try {
      // Deactivate the current session
      if (accessToken) {
        await sessionService.deactivateSession(accessToken);
      }
      
      logger.info('User logged out successfully', { token: accessToken?.substring(0, 20) + '...' });
    } catch (error) {
      logger.error('Failed to logout user', { error: error.message, token: accessToken?.substring(0, 20) + '...' });
      // Don't throw error to ensure logout still completes
    }
  },

  refreshSession: async (accessToken) => {
    try {
      // Verify the current token
      const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
      
      // Get user info with the same structure as loginUser
      const user = await userRepository.findUserById(decoded.userId, {
        include: {
          userDepartmentRoles: {
            include: {
              department: { select: { id: true, name: true } },
              role: { select: { id: true, name: true, loginDestination: true } },
            },
          },
          userRoles: { include: { role: { select: { id: true, name: true, loginDestination: true } } } },
          tenant: { select: { name: true, status: true, logoUrl: true } },
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Determine primary department/role (same logic as loginUser)
      const userDepartmentRoles = user.userDepartmentRoles || [];
      const primaryDR = userDepartmentRoles.find(udr => udr.isPrimaryDepartment || udr.isPrimaryRole) || userDepartmentRoles[0];
      const primaryDepartment = primaryDR?.department ? { id: primaryDR.department.id, name: primaryDR.department.name } : null;
      const primaryRole = primaryDR?.role ? { id: primaryDR.role.id, name: primaryDR.role.name } : null;
      
      // Build roles array with department context
      const roles = userDepartmentRoles.map(udr => ({
        id: udr.role?.id,
        name: udr.role?.name,
        type: udr.department ? 'department' : 'global',
        department: udr.department ? { id: udr.department.id, name: udr.department.name } : null,
        isPrimaryDepartment: udr.isPrimaryDepartment,
        isPrimaryRole: udr.isPrimaryRole,
      }));
      
      // Build departments array
      const departments = userDepartmentRoles
        .filter(udr => udr.department)
        .map(udr => ({ id: udr.department.id, name: udr.department.name }));

      // Build userRoles array (global roles)
      let userRoles = [];
      if (user.userRoles && user.userRoles.length > 0) {
        if (user.userRoles[0].role) {
          userRoles = user.userRoles.map(ur => ({
            id: ur.role.id,
            name: ur.role.name,
            loginDestination: ur.role.loginDestination,
            isDefault: ur.isDefault,
          }));
        } else {
          userRoles = user.userRoles.map(ur => ({
            id: ur.id,
            name: ur.name,
            isDefault: ur.isDefault,
          }));
        }
      }

      // Determine defaultRole from userRoles
      let defaultRole = null;
      if (userRoles.length > 0) {
        defaultRole = userRoles.find(r => r.isDefault) || userRoles[0];
      }

      // Generate new token with the same structure as loginUser
      const newAccessToken = generateAccessToken(
        {
          userId: user.id,
          tenantId: user.tenantId,
          roles,
          userRoles,
          departments,
          primaryDepartment,
          primaryRole,
          defaultRole,
        },
        process.env.ACCESS_TOKEN_SECRET,
        '4h'
      );
      
      // Update session in database
      await sessionService.updateSessionToken(accessToken, newAccessToken);
      
      return {
        accessToken: newAccessToken,
        expiresIn: '4h'
      };
    } catch (error) {
      logger.error('Failed to refresh session', { error: error.message });
      throw new Error('Failed to refresh session');
    }
  },

  verifyOTP: async (email, otp) => {
    await verifyOTP(email, otp);
  },

  resendOTP: async (email) => {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error('User not found');
    if (user.verified) throw new Error('User already verified');
    await sendOTP(email);
  },

  forgotPassword: async (email) => {
    const user = await userRepository.findUserByEmail(email);
    if (!user) throw new Error('User not found');
    const token = crypto.randomBytes(20).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await userRepository.createResetPasswordToken({ userId: user.id, token, expiresAt });
    return token;
  },

  sendPasswordResetEmail: async (email, resetLink) => {
    await sendPasswordResetEmail(email, resetLink);
  },

  resetPassword: async (token, password) => {
    const resetToken = await userRepository.findResetPasswordToken(token);
    if (!resetToken || resetToken.expiresAt < new Date()) {
      throw new Error('Invalid or expired token');
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    await userRepository.updateUserById(resetToken.userId, { password: hashedPassword });
    await userRepository.deleteResetPasswordToken(token);
  },
};

module.exports = authService;