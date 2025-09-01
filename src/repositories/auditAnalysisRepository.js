const { prisma } = require('../../prisma/client');

function upsertAuditAnalysis({ auditId, department, submittedById, metrics, remarks, finished }) {
  const deptKey = department || "";
  return prisma.auditAnalysis.upsert({
    where: {
      auditId_department: {
        auditId,
        department: deptKey,
      },
    },
    update: {
      metrics,
      remarks,
      finished,
      finishedAt: finished ? new Date() : null,
    },
    create: {
      auditId,
      department: deptKey,
      submittedById,
      metrics,
      remarks,
      finished,
      finishedAt: finished ? new Date() : null,
    },
  });
}

function getAuditAnalysis(auditId, department) {
  const deptKey = department || "";
  return prisma.auditAnalysis.findUnique({
    where: {
      auditId_department: {
        auditId,
        department: deptKey,
      },
    },
  });
}

// New comprehensive analysis repository methods
async function getComprehensiveAnalysis(auditId, departmentId) {
  const deptKey = departmentId || "";
  
  // Try to find existing comprehensive analysis
  const analysis = await prisma.auditAnalysis.findUnique({
    where: {
      auditId_department: {
        auditId,
        department: deptKey,
      },
    },
  });
  
  if (!analysis) {
    return null;
  }
  
  // Transform legacy format to new comprehensive format if needed
  return {
    auditId: analysis.auditId,
    auditTitle: `Audit ${analysis.auditId}`, // Would get from audit table in real implementation
    auditType: 'Internal Audit', // Would get from audit table
    departmentId: departmentId,
    departmentName: departmentId, // Would resolve from department table
    analysisData: analysis.metrics || [],
    totalFindings: (analysis.metrics || []).reduce((sum, m) => sum + (m.count || 0), 0),
    completionPercentage: 100, // Would calculate based on workflow completion
    generatedAt: analysis.createdAt.toISOString(),
    analyzedBy: 'Team Leader', // Would get from user table
    isCompleted: analysis.finished,
    remarks: analysis.remarks || ''
  };
}

async function saveComprehensiveAnalysis(analysisData) {
  const {
    auditId,
    departmentId,
    analysisData: metrics,
    remarks,
    isCompleted,
    submittedById
  } = analysisData;
  
  const deptKey = departmentId || "";
  
  return await prisma.auditAnalysis.upsert({
    where: {
      auditId_department: {
        auditId,
        department: deptKey,
      },
    },
    update: {
      metrics,
      remarks,
      finished: isCompleted,
      finishedAt: isCompleted ? new Date() : null,
    },
    create: {
      auditId,
      department: deptKey,
      submittedById,
      metrics,
      remarks,
      finished: isCompleted,
      finishedAt: isCompleted ? new Date() : null,
    },
  });
}

module.exports = {
  // Legacy methods
  upsertAuditAnalysis,
  getAuditAnalysis,
  // New comprehensive analysis methods
  getComprehensiveAnalysis,
  saveComprehensiveAnalysis,
}; 