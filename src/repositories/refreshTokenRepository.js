const { prisma } = require('../../prisma/client');

const refreshTokenRepository = {
  findRefreshToken: async (token) => {
    return prisma.refreshToken.findUnique({ where: { token } });
  },

  createRefreshToken: async (data) => {
    return prisma.refreshToken.create({ data });
  },

  deleteRefreshToken: async (token) => {
    return prisma.refreshToken.deleteMany({ where: { token } });
  },
};

module.exports = refreshTokenRepository;