const { prisma } = require('../../prisma/client');

async function updateCorrectionRequirement(correctiveActionId, correctionRequirement) {
  return prisma.correctiveAction.update({
    where: { id: correctiveActionId },
    data: { correctionRequirement }
  });
}

module.exports = {
  updateCorrectionRequirement,
}; 