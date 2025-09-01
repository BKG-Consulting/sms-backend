const { prisma } = require('../../prisma/client');

const createFinding = (data) => prisma.auditFinding.create({ data, include: { createdBy: true, nonConformities: true } });
const getFindingsByAudit = async (auditId, tenantId) => {
  const findings = await prisma.auditFinding.findMany({
    where: { 
      auditId,
      audit: {
        auditProgram: {
          tenantId: tenantId
        }
      }
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      criteria: true,
      createdAt: true,
      updatedAt: true,
      category: true,
      department: true,
      createdById: true, // <-- Added for frontend categorization logic
      reviewed: true, // <-- Added for frontend categorization logic
      nonConformities: {
        select: {
          id: true,
          title: true,
          type: true,
          severity: true,
          status: true
        }
      },
      improvements: {
        select: {
          id: true,
          opportunity: true,
          status: true,
          observationRequirement: true,
          proposedAction: true,
          appropriatenessReview: true,
          followUpAction: true,
          actionEffectiveness: true,
          mrNotified: true
        }
      },
      compliance: {
        select: {
          id: true,
          status: true
        }
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      },
      audit: {
        select: {
          type: true,
          auditProgram: {
            select: {
              title: true
            }
          }
        }
      },
    },
    orderBy: { createdAt: 'desc' }
  });

  // Fix for Prisma relationship issue: manually fetch ImprovementOpportunity for IMPROVEMENT findings
  const findingsWithFixedImprovements = await Promise.all(
    findings.map(async (finding) => {
      if (finding.category === 'IMPROVEMENT' && (!finding.improvements || !finding.improvements.id)) {
        console.log(`🔧 [FINDING_REPO] Relationship issue detected for finding ${finding.id}, manually fetching ImprovementOpportunity`);
        try {
          const improvements = await prisma.improvementOpportunity.findUnique({
            where: { findingId: finding.id },
            select: {
              id: true,
              opportunity: true,
              status: true,
              observationRequirement: true,
              proposedAction: true,
              appropriatenessReview: true,
              followUpAction: true,
              actionEffectiveness: true,
              mrNotified: true
            }
          });
          console.log(`✅ [FINDING_REPO] Manually fetched ImprovementOpportunity for finding ${finding.id}:`, {
            found: !!improvements,
            id: improvements?.id,
            opportunity: improvements?.opportunity,
            status: improvements?.status
          });
          return {
            ...finding,
            improvements: improvements
          };
        } catch (error) {
          console.error(`❌ [FINDING_REPO] Failed to manually fetch ImprovementOpportunity for finding ${finding.id}:`, error);
          return finding;
        }
      }
      return finding;
    })
  );

  return findingsWithFixedImprovements;
};
const getFindingById = async (id) => {
  const finding = await prisma.auditFinding.findUnique({ 
    where: { id }, 
    include: { 
      createdBy: true, 
      nonConformities: true,
      improvements: true,
      compliance: true,
      audit: {
        include: {
          auditProgram: {
            select: {
              tenantId: true
            }
          }
        }
      }
    } 
  });

  if (!finding) return null;

  // Fix for Prisma relationship issue: manually fetch ImprovementOpportunity if relationship fails
  let improvements = finding.improvements;
  if (finding.category === 'IMPROVEMENT' && (!improvements || !improvements.id)) {
    console.log(`🔧 [FINDING_REPO] Relationship issue detected for finding ${id}, manually fetching ImprovementOpportunity`);
    try {
      improvements = await prisma.improvementOpportunity.findUnique({
        where: { findingId: id }
      });
      console.log(`✅ [FINDING_REPO] Manually fetched ImprovementOpportunity:`, {
        found: !!improvements,
        id: improvements?.id,
        opportunity: improvements?.opportunity,
        status: improvements?.status
      });
    } catch (error) {
      console.error(`❌ [FINDING_REPO] Failed to manually fetch ImprovementOpportunity:`, error);
    }
  }

  // Get department HOD information
  let departmentHOD = null;
  if (finding.department && finding.audit?.auditProgram?.tenantId) {
    departmentHOD = await prisma.department.findFirst({
      where: {
        name: finding.department,
        tenantId: finding.audit.auditProgram.tenantId
      },
      include: {
        hod: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });
  }

  // Add auditee information to the finding and fix improvements
  return {
    ...finding,
    improvements: improvements, // Use the manually fetched improvements if relationship failed
    auditee: departmentHOD?.hod ? `${departmentHOD.hod.firstName} ${departmentHOD.hod.lastName}` : null,
    departmentHOD: departmentHOD?.hod || null
  };
};
const updateFinding = (id, data) => prisma.auditFinding.update({ where: { id }, data, include: { createdBy: true, nonConformities: true, improvements: true, compliance: true } });
const deleteFinding = (id) => prisma.auditFinding.delete({ where: { id } });
const getGlobalFindings = (where) => prisma.auditFinding.findMany({
  where,
  select: {
    id: true,
    title: true,
    description: true,
    status: true,
    criteria: true,
    createdAt: true,
    updatedAt: true,
    category: true,
    department: true,
    audit: {
      select: {
        type: true,
        auditProgram: {
          select: {
            title: true
          }
        }
      }
    },
  },
  orderBy: { createdAt: 'desc' }
});

const getGlobalFindingsPaginated = async (where, skip, take) => {
  const [findings, total] = await Promise.all([
    prisma.auditFinding.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        criteria: true,
        createdAt: true,
        updatedAt: true,
        category: true,
        department: true,
        audit: {
          select: {
            type: true,
            auditProgram: {
              select: {
                title: true
              }
            }
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.auditFinding.count({ where })
  ]);
  return { findings, total };
};

const getNonConformitiesPaginated = async (where, skip, take) => {
  const [nonConformities, total] = await Promise.all([
    prisma.nonConformity.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        type: true,
        severity: true,
        status: true,
        clauseNumber: true,
        createdAt: true,
        updatedAt: true,
        finding: {
          select: {
            id: true,
            department: true,
            criteria: true,
            audit: {
              select: {
                id: true,
                auditNo: true,
                type: true,
                auditProgram: {
                  select: {
                    id: true,
                    title: true
                  }
                }
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.nonConformity.count({ where })
  ]);
  return { nonConformities, total };
};

module.exports = {
  createFinding,
  getFindingsByAudit,
  getFindingById,
  updateFinding,
  deleteFinding,
  getGlobalFindings,
  getGlobalFindingsPaginated,
  getNonConformitiesPaginated,
}; 