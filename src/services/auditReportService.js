const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');
const PDFDocument = require('pdfkit');
const storageService = require('../config/storage');

/**
 * Strip HTML tags and clean text for PDF generation
 */
function cleanTextForPDF(text) {
  if (!text) return '';
  
  // Remove HTML tags
  const withoutTags = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  const decoded = withoutTags
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Clean up extra whitespace
  return decoded.trim().replace(/\s+/g, ' ');
}

/**
 * Clean array of text items for PDF generation
 */
function cleanArrayForPDF(array) {
  if (!Array.isArray(array)) return [];
  return array.map(item => cleanTextForPDF(item)).filter(item => item.length > 0);
}

/**
 * Check if findings are categorized for specific scopes
 */
function getCategorizedScopes(findings, audit) {
  const categorizedScopes = new Set();
  const allScopes = audit.scope || [];
  
  findings.forEach(finding => {
    if (finding.category && finding.department && allScopes.includes(finding.department)) {
      categorizedScopes.add(finding.department);
    }
  });
  
  return {
    categorized: Array.from(categorizedScopes),
    total: allScopes.length,
    isComplete: categorizedScopes.size === allScopes.length
  };
}

/**
 * Get report title based on completeness
 */
function getReportTitle(audit, isPartial, categorizedScopes) {
  const baseTitle = `${audit.auditProgram.tenant.name} AUDIT REPORT`;
  const auditTitle = `${audit.auditProgram.title}, ${audit.type.replace(/_/g, ' ')}`;
  
  if (isPartial && categorizedScopes.categorized.length > 0) {
    return `${baseTitle}\n\nPartial Report - ${categorizedScopes.categorized.join(', ')}\n\n${auditTitle}`;
  }
  
  return `${baseTitle}\n\n${auditTitle}`;
}

/**
 * Generate comprehensive audit report as PDF and save to S3
 * Supports progressive generation - partial reports when some scopes are categorized
 */
async function generateAuditReport(auditId, tenantId, userId, options = {}) {
  const { isPartial = false, scopes = [] } = options;
  try {
    // 1. Get audit with all related data
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: { tenantId }
      },
      include: {
        auditProgram: {
          include: {
            tenant: {
              include: {
                departments: {
                  include: {
                    hod: {
                      select: { id: true, firstName: true, lastName: true, email: true }
                    }
                  }
                }
              }
            }
          }
        },
        teamMembers: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true } }
          }
        },
        auditPlans: true,
        planningMeetings: {
          include: {
            attendances: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } }
              }
            },
            agendas: true
          }
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    // 2. Get all findings for this audit
    let findingsWhere = { auditId };
    
    // For partial reports, filter by specific scopes
    if (isPartial && scopes.length > 0) {
      findingsWhere.department = { in: scopes };
    }
    
    const findings = await prisma.auditFinding.findMany({
      where: findingsWhere,
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        nonConformities: true,
        compliance: true,
        improvements: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Check categorization status
    const categorizedScopes = getCategorizedScopes(findings, audit);
    
    // For partial reports, ensure we only include categorized findings
    const filteredFindings = isPartial 
      ? findings.filter(f => f.category && scopes.includes(f.department))
      : findings;

    // 3. Fetch audit plan
    const auditPlan = await prisma.auditPlan.findUnique({
      where: { auditId },
    });

    // 4. Fetch meetings using new models
    const openingMeeting = await prisma.openingMeeting.findFirst({
      where: { auditId, archived: false },
      include: {
        agendas: { orderBy: { order: 'asc' } },
        attendances: { 
          include: { 
            user: { 
              select: { 
                id: true, 
                firstName: true, 
                lastName: true, 
                email: true 
              } 
            } 
          } 
        }
      }
    });
    
    const closingMeeting = await prisma.closingMeeting.findFirst({
      where: { auditId, archived: false },
      include: {
        agendas: { orderBy: { order: 'asc' } },
        attendances: { 
          include: { 
            user: { 
              select: { 
                id: true, 
                firstName: true, 
                lastName: true, 
                email: true 
              } 
            } 
          } 
        }
      }
    });

    // 5. Progressive Report Generation
    const reportTitle = getReportTitle(audit, isPartial, categorizedScopes);
    const baseReportTitle = isPartial 
      ? `Partial Audit Report - ${audit.auditProgram.title} (Audit #${audit.auditNo})`
      : `Audit Report - ${audit.auditProgram.title} (Audit #${audit.auditNo})`;
    
    const existingReports = await prisma.document.findMany({
      where: {
        tenantId,
        auditId: auditId,
        type: 'AUDIT_REPORT'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const versionNumber = existingReports.length + 1;
    const finalReportTitle = versionNumber === 1 
      ? baseReportTitle 
      : `${baseReportTitle} - Version ${versionNumber}`;

    // 6. Generate PDF with improved structure
    const pdfBuffer = await generateProfessionalPDFReport(audit, filteredFindings, auditPlan, openingMeeting, closingMeeting, { isPartial, categorizedScopes });

    // 7. Upload using storage service (supports S3, Cloudinary, or local)
    const fileName = `audit_report_${audit.auditNo}_v${versionNumber}_${Date.now()}.pdf`;
    
    // Create a file-like object for the storage service
    const fileObject = {
      buffer: pdfBuffer,
      originalname: fileName,
      mimetype: 'application/pdf'
    };
    
    const uploadResult = await storageService.uploadFile(fileObject, fileName);
    const fileUrl = uploadResult.url;

    // 8. Create document record
    const document = await prisma.document.create({
      data: {
        title: finalReportTitle,
        description: `Professional audit report for ${audit.auditProgram.title} conducted from ${formatDate(audit.auditDateFrom)} to ${formatDate(audit.auditDateTo)}${versionNumber > 1 ? ` (Version ${versionNumber})` : ''}`,
        type: 'AUDIT_REPORT',
        status: 'DRAFT',
        tenantId,
        ownerId: userId,
        auditId: auditId,
      }
    });

    // 9. Create document version
    const versionData = {
      documentId: document.id,
      version: versionNumber,
      fileUrl,
      createdById: userId,
    };

    // Add storage-specific fields based on storage type
    if (uploadResult.storageType === 's3') {
      versionData.s3Key = fileName;
    } else if (uploadResult.storageType === 'cloudinary') {
      versionData.cloudinaryId = uploadResult.cloudinaryId;
    }

    const version = await prisma.documentVersion.create({
      data: versionData
    });

    // 10. Update document with current version
    await prisma.document.update({
      where: { id: document.id },
      data: { currentVersionId: version.id }
    });

    return {
      message: versionNumber === 1 
        ? 'Professional audit report generated successfully' 
        : `Audit report version ${versionNumber} generated successfully`,
      document: {
        ...document,
        currentVersion: version
      }
    };
  } catch (error) {
    console.error('Error generating audit report:', error);
    throw error;
  }
}

/**
 * Generate professional PDF report with clean, print-friendly layout
 */
async function generateProfessionalPDFReport(audit, findings, auditPlan, openingMeeting, closingMeeting, options = {}) {
  const { isPartial = false, categorizedScopes = null } = options;
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Audit Report - ${audit.auditProgram.title}`,
          Author: 'Internal Audit Department',
          Subject: `Audit Report for ${audit.auditProgram.tenant.name}`,
          Keywords: 'audit, report, compliance, internal audit'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // ==================== 1.0 AUDIT REPORT ====================
      generateReportHeader(doc, audit, isPartial, categorizedScopes);

      // ==================== 2.0 AUDIT SCOPE AND METHODOLOGY ====================
      generateAuditScopeSection(doc, audit);

      // ==================== 3.0 AUDIT FINDINGS ====================
      doc.addPage();
      generateAuditFindingsSection(doc, audit, findings);

      // ==================== 4.0 CONCLUSIONS AND RECOMMENDATIONS ====================
      doc.addPage();
      generateConclusionsSection(doc, audit, findings);

      // ==================== 5.0 ANNEXES ====================
      doc.addPage();
      generateAnnexesSection(doc, auditPlan, openingMeeting, closingMeeting, audit);

      doc.end();
    } catch (error) {
      console.error('Error in generateProfessionalPDFReport:', error);
      reject(error);
    }
  });
}

function generateReportHeader(doc, audit, isPartial = false, categorizedScopes = null) {
  // Organization Header
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text(audit.auditProgram.tenant.name, 50, 80, { align: 'center' });

  // Title
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('INTERNAL AUDIT REPORT', 50, 120, { align: 'center' });

  // Audit Program Title
  doc.fontSize(14)
     .font('Helvetica')
     .fillColor('black')
     .text(audit.auditProgram.title, 50, 150, { align: 'center' });

  // Audit Type
  doc.fontSize(12)
     .font('Helvetica')
     .fillColor('black')
     .text(`${audit.type} Audit`, 50, 175, { align: 'center' });

  // Partial report indicator
  if (isPartial && categorizedScopes) {
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(`PARTIAL REPORT - ${categorizedScopes.categorized.join(', ')}`, 50, 200, { align: 'center' });
  }
}

function generateAuditScopeSection(doc, audit) {
  let yPosition = 250;
  
  // Audit Period
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Audit Period', 50, yPosition);
  
  yPosition += 25;
  
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('black')
     .text(`From: ${formatDate(audit.auditDateFrom)}`, 70, yPosition);
  
  yPosition += 20;
  
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('black')
     .text(`To: ${formatDate(audit.auditDateTo)}`, 70, yPosition);
  
  yPosition += 40;
  
  // Objectives
  if (audit.objectives && audit.objectives.length > 0) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Objectives', 50, yPosition);
    
    yPosition += 25;
    
    const cleanObjectives = cleanArrayForPDF(audit.objectives);
    cleanObjectives.forEach((objective, index) => {
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(`${index + 1}. ${objective}`, 70, yPosition, {
           width: doc.page.width - 120,
           align: 'justify'
         });
      yPosition += 25;
    });
    
    yPosition += 30;
  }
  
  // Scope
  if (audit.scope && audit.scope.length > 0) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Scope', 50, yPosition);
    
    yPosition += 25;
    
    const cleanScope = cleanArrayForPDF(audit.scope);
    cleanScope.forEach((scopeItem, index) => {
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(`${index + 1}. ${scopeItem}`, 70, yPosition, {
           width: doc.page.width - 120,
           align: 'justify'
         });
      yPosition += 25;
    });
    
    yPosition += 30;
  }
  
  // Criteria
  if (audit.criteria && audit.criteria.length > 0) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Criteria', 50, yPosition);
    
    yPosition += 25;
    
    const cleanCriteria = cleanArrayForPDF(audit.criteria);
    cleanCriteria.forEach((criterion, index) => {
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(`${index + 1}. ${criterion}`, 70, yPosition, {
           width: doc.page.width - 120,
           align: 'justify'
         });
      yPosition += 25;
    });
    
    yPosition += 30;
  }
  
  // Audit Team
  if (audit.teamMembers && audit.teamMembers.length > 0) {
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text('Audit Team', 50, yPosition);
    
    yPosition += 25;
    
    audit.teamMembers.forEach((member, index) => {
      const role = member.role === 'TEAM_LEADER' ? ' (Team Leader)' : '';
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text(`${member.user.firstName} ${member.user.lastName}${role}`, 70, yPosition);
      yPosition += 20;
    });
  }
}

// Helper function to add section headers consistently
function addSectionHeader(doc, title, x) {
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text(title, x, 80);
}

function generateAuditFindingsSection(doc, audit, findings) {
  // Section header
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Audit Findings', 50, 80);
  
  let yPosition = 120;
  
  // Get all scope items from audit
  const allScopeItems = audit.scope || [];
  
  // Group findings by department
  const findingsByDept = groupFindingsByDepartment(findings, audit);
  
  // Process each scope item
  allScopeItems.forEach((scopeItem, scopeIndex) => {
    // Check if we need a new page
    if (yPosition > doc.page.height - 250) {
      doc.addPage();
      yPosition = 120;
    }

    // Extract department name from scope item
    const deptMatch = scopeItem.match(/(?:Department:\s*)?([^,]+)/);
    const departmentName = deptMatch ? deptMatch[1].trim() : scopeItem;
    
    // Department header
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(departmentName, 50, yPosition);
    
    yPosition += 30;

    // Get findings for this department
    const deptData = findingsByDept[departmentName];
    const allFindings = deptData ? [
      ...deptData.positives,
      ...deptData.improvements,
      ...deptData.nonConformities
    ] : [];

    if (allFindings.length === 0) {
      // No findings for this department
      doc.fontSize(11)
         .font('Helvetica')
         .fillColor('black')
         .text('No findings', 70, yPosition);
      
      yPosition += 25;
    } else {
      // Findings for this department
      allFindings.forEach((finding, index) => {
        if (yPosition > doc.page.height - 250) {
          doc.addPage();
          yPosition = 120;
        }

        // Finding title
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor('black')
           .text(`Finding ${index + 1}: ${finding.title}`, 70, yPosition);
        
        yPosition += 25;

        // Finding description
        doc.fontSize(11)
           .font('Helvetica')
           .fillColor('black')
           .text(finding.description, 70, yPosition, {
             width: doc.page.width - 120,
             align: 'justify'
           });
        
        yPosition += 35;

        // Finding category and status
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('black')
           .text(`Category: ${finding.category || 'Not categorized'} | Status: ${finding.status}`, 70, yPosition);
        
        yPosition += 30;
      });
    }

    yPosition += 30; // Space between departments
  });
}

function generateConclusionsSection(doc, audit, findings) {
  // Section header
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Conclusions and Recommendations', 50, 80);
  
  let yPosition = 120;
  
  // Overall conclusions
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Overall Conclusions', 50, yPosition);
  
  yPosition += 30;
  
  const stats = calculateFindingsStats(findings);
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('black')
     .text(`Based on the audit findings, the organization demonstrates ${stats.positives > 0 ? 'good compliance' : 'areas requiring attention'} in several key areas. The audit identified ${stats.total} findings, with ${stats.nonConformities} non-conformities requiring immediate attention.`, 50, yPosition, {
       width: doc.page.width - 100,
       align: 'justify'
     });
  
  yPosition += 60;
  
  // Recommendations
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Recommendations', 50, yPosition);
  
  yPosition += 30;
  
  const recommendations = [
    'Address all non-conformities within the specified timeframe',
    'Implement corrective actions for improvement opportunities',
    'Strengthen documentation and record-keeping procedures',
    'Provide additional training where gaps are identified',
    'Establish monitoring mechanisms for ongoing compliance'
  ];
  
  recommendations.forEach((rec, index) => {
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text(`${index + 1}. ${rec}`, 70, yPosition, {
         width: doc.page.width - 120,
         align: 'justify'
       });
    yPosition += 30;
  });
  
  yPosition += 50;
  
  // Signature section
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Signed:', 50, yPosition);
  
  yPosition += 30;
  
  const teamLeader = audit.teamMembers.find(tm => tm.role === 'TEAM_LEADER');
  if (teamLeader) {
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor('black')
       .text(`${teamLeader.user.firstName} ${teamLeader.user.lastName}`, 70, yPosition);
    
    yPosition += 25;
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('black')
       .text('Team Leader', 70, yPosition);
    
    yPosition += 25;
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor('black')
       .text(`Date: ${formatDate(new Date())}`, 70, yPosition);
  }
}

function generateAnnexesSection(doc, auditPlan, openingMeeting, closingMeeting, audit) {
  // Section header
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Annexes', 50, 80);
  
  let yPosition = 120;
  
  // Annex A: Audit Timetable
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Annex A: Audit Timetable', 50, yPosition);
  
  yPosition += 30;
  
  if (auditPlan && auditPlan.timetable && Array.isArray(auditPlan.timetable) && auditPlan.timetable.length > 0) {
    // Timetable table
    const tableTop = yPosition;
    const colWidths = [40, 100, 100, 200, 150];
    const headers = ['No.', 'Time From', 'Time To', 'Activity', 'Participants'];
    let xPos = 70;

    // Table header
    doc.fontSize(10)
       .font('Helvetica-Bold')
       .fillColor('black');

    headers.forEach((header, index) => {
      doc.text(header, xPos, yPosition);
      xPos += colWidths[index];
    });

    yPosition += 25;

    // Table rows
    auditPlan.timetable.forEach((item, index) => {
      if (yPosition > doc.page.height - 250) {
        doc.addPage();
        yPosition = 120;
      }

      xPos = 70;

      doc.fontSize(9).font('Helvetica').fillColor('black');
      
      const rowData = [
        (index + 1).toString(),
        item.from || '',
        item.to || '',
        item.activity || '',
        Array.isArray(item.participants) ? item.participants.join(', ') : ''
      ];

      rowData.forEach((data, colIndex) => {
        doc.text(data, xPos, yPosition, { width: colWidths[colIndex] - 5 });
        xPos += colWidths[colIndex];
      });
      
      yPosition += 25;
    });

    // Draw table borders
    doc.rect(70, tableTop - 20, doc.page.width - 140, yPosition - tableTop + 20).stroke();
    
    // Draw vertical lines
    let borderXPos = 70;
    colWidths.forEach((width, index) => {
      if (index < colWidths.length - 1) {
        borderXPos += width;
        doc.moveTo(borderXPos, tableTop - 20).lineTo(borderXPos, yPosition).stroke();
      }
    });

    // Draw horizontal line after header
    doc.moveTo(70, tableTop + 5).lineTo(doc.page.width - 70, tableTop + 5).stroke();
    
  } else {
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text('Audit timetable not available.', 70, yPosition);
    yPosition += 25;
  }
  
  yPosition += 50;
  
  // Annex B: Meeting Records
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Annex B: Meeting Records', 50, yPosition);
  
  yPosition += 30;
  
  if (openingMeeting) {
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text('Opening Meeting: Completed', 70, yPosition);
    yPosition += 25;
  }
  
  if (closingMeeting) {
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('black')
       .text('Closing Meeting: Completed', 70, yPosition);
    yPosition += 25;
  }
  
  yPosition += 50;
  
  // Annex C: Supporting Documents
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text('Annex C: Supporting Documents', 50, yPosition);
  
  yPosition += 30;
  
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor('black')
     .text('All supporting documents, evidence, and records are maintained in the audit management system.', 70, yPosition, {
       width: doc.page.width - 120,
       align: 'justify'
     });
  
  // Footer
  yPosition += 80;
  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('black')
     .text(`Generated on ${formatDate(new Date())}`, 50, yPosition, { align: 'center' });
}

// Helper function for ordinal suffixes
function getOrdinalSuffix(num) {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) {
    return 'st';
  }
  if (j === 2 && k !== 12) {
    return 'nd';
  }
  if (j === 3 && k !== 13) {
    return 'rd';
  }
  return 'th';
}

// Helper functions
function addSectionHeader(doc, title, x) {
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor('black')
     .text(title, x, 100);
  
  // Simple underline
  doc.moveTo(x, 115)
     .lineTo(doc.page.width - 72, 115)
     .strokeColor('black')
     .lineWidth(1)
     .stroke();
}

function generateTable(doc, data, x, y, width, options = {}) {
  const {
    rowHeight = 25,
    fontSize = 11
  } = options;

  const colWidth = width / 2;
  let currentY = y;

  data.forEach((row, index) => {
    const isHeader = index === 0;

    // Simple border
    doc.rect(x, currentY, width, rowHeight)
       .stroke('black');

    // Cell content
    doc.fontSize(fontSize)
       .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
       .fillColor('black');

    doc.text(row[0], x + 5, currentY + 5, { width: colWidth - 10 });
    doc.text(row[1], x + colWidth + 5, currentY + 5, { width: colWidth - 10 });

    currentY += rowHeight;
  });
}

function calculateFindingsStats(findings) {
  return {
    total: findings.length,
    nonConformities: findings.filter(f => f.category === 'NON_CONFORMITY').length,
    improvements: findings.filter(f => f.category === 'IMPROVEMENT').length,
    positives: findings.filter(f => f.category === 'COMPLIANCE').length
  };
}

function getLeadAuditor(teamMembers) {
  const leader = teamMembers.find(tm => tm.role === 'TEAM_LEADER');
  return leader ? `${leader.user.firstName} ${leader.user.lastName}` : 'Not specified';
}

function groupFindingsByDepartment(findings, audit) {
  const departments = {};
  
  // Initialize departments from audit scope
  if (audit.scope && Array.isArray(audit.scope)) {
    audit.scope.forEach(scopeItem => {
      const deptMatch = scopeItem.match(/(?:Department:\s*)?([^,]+)/);
      if (deptMatch) {
        const deptName = deptMatch[1].trim();
        departments[deptName] = {
          positives: [],
          improvements: [],
          nonConformities: [],
          hasFindings: false
        };
      }
    });
  }

  // Group findings by department
  findings.forEach(finding => {
    if (finding.department) {
      if (!departments[finding.department]) {
        departments[finding.department] = {
          positives: [],
          improvements: [],
          nonConformities: [],
          hasFindings: false
        };
      }
      
      departments[finding.department].hasFindings = true;
      
      switch (finding.category) {
        case 'COMPLIANCE':
          departments[finding.department].positives.push(finding);
          break;
        case 'IMPROVEMENT':
          departments[finding.department].improvements.push(finding);
          break;
        case 'NON_CONFORMITY':
          departments[finding.department].nonConformities.push(finding);
          break;
      }
    }
  });

  return departments;
}

function formatDate(date) {
  if (!date) return 'Not specified';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric' 
  });
}

function formatDateRange(start, end) {
  if (!start || !end) return 'Not specified';
  const startDate = formatDate(start);
  const endDate = formatDate(end);
  return `${startDate} to ${endDate}`;
}

async function getAuditReportStats(auditId, tenantId) {
  const findings = await prisma.auditFinding.findMany({
    where: { auditId },
    select: { category: true, department: true }
  });

  const totalFindings = findings.length;
  const byCategory = {
    positives: findings.filter(f => f.category === 'COMPLIANCE').length,
    improvements: findings.filter(f => f.category === 'IMPROVEMENT').length,
    nonConformities: findings.filter(f => f.category === 'NON_CONFORMITY').length,
  };

  const byDepartment = {};
  findings.forEach(finding => {
    if (!byDepartment[finding.department]) {
      byDepartment[finding.department] = {
        total: 0,
        positives: 0,
        improvements: 0,
        nonConformities: 0,
      };
    }
    byDepartment[finding.department].total++;
    switch (finding.category) {
      case 'COMPLIANCE':
        byDepartment[finding.department].positives++;
        break;
      case 'IMPROVEMENT':
        byDepartment[finding.department].improvements++;
        break;
      case 'NON_CONFORMITY':
        byDepartment[finding.department].nonConformities++;
        break;
    }
  });

  return {
    totalFindings,
    byCategory,
    byDepartment,
  };
}

/**
 * Get categorization status for an audit
 */
async function getAuditCategorizationStatus(auditId, tenantId) {
  try {
    const audit = await prisma.audit.findFirst({
      where: {
        id: auditId,
        auditProgram: { tenantId }
      },
      include: {
        auditProgram: {
          include: {
            tenant: true
          }
        }
      }
    });

    if (!audit) {
      throw new AppError('Audit not found', 404);
    }

    const findings = await prisma.auditFinding.findMany({
      where: { auditId },
      select: { department: true, category: true }
    });

    const categorizedScopes = getCategorizedScopes(findings, audit);
    
    return {
      audit: {
        id: audit.id,
        auditNo: audit.auditNo,
        type: audit.type,
        scope: audit.scope,
        title: audit.auditProgram.title,
        organization: audit.auditProgram.tenant.name
      },
      categorizationStatus: categorizedScopes,
      canGeneratePartial: categorizedScopes.categorized.length > 0,
      canGenerateFull: categorizedScopes.isComplete
    };
  } catch (error) {
    console.error('Error getting categorization status:', error);
    throw error;
  }
}

module.exports = {
  generateAuditReport,
  getAuditCategorizationStatus,
  getAuditReportStats,
};