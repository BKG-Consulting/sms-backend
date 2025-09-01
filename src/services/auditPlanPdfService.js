// services/auditPlanPdfService.js
const { prisma } = require('../../prisma/client');
const { AppError } = require('../../errors/app.error');
const PDFDocument = require('pdfkit');
const s3 = require('../config/s3');
const { logger } = require('../utils/logger');

/**
 * Generate comprehensive audit plan as PDF and save to S3
 */
async function generateAuditPlanPdf(auditId, tenantId, userId) {
  try {
    // 1. Fetch comprehensive audit plan data
    const auditPlan = await prisma.auditPlan.findFirst({
      where: {
        auditId,
        audit: {
          auditProgram: { tenantId }
        }
      },
      include: {
        audit: {
          include: {
            auditProgram: {
              include: {
                tenant: {
                  select: {
                    id: true,
                    name: true,
                    legalName: true
                  }
                }
              }
            },
            teamMembers: {
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
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    if (!auditPlan) {
      throw new AppError('Audit plan not found', 404);
    }

    // 2. Generate the PDF document title
    const baseTitle = `Audit Plan - ${auditPlan.audit.auditProgram.title} (Audit #${auditPlan.audit.auditNo})`;
    
    // Check for existing audit plan PDFs to determine version
    const existingPlans = await prisma.document.findMany({
      where: {
        tenantId,
        auditId: auditId,
        type: 'AUDIT_PLAN'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    const versionNumber = existingPlans.length + 1;
    const documentTitle = versionNumber === 1 
      ? baseTitle 
      : `${baseTitle} - Version ${versionNumber}`;

    // 3. Generate PDF buffer
    const pdfBuffer = await generatePDFPlan(auditPlan);

    // 4. Upload to S3
    const fileName = `audit_plan_${auditPlan.audit.auditNo}_${Date.now()}.pdf`;
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
      Metadata: {
        auditId: auditId,
        auditPlanId: auditPlan.id,
        generatedAt: new Date().toISOString(),
        documentType: 'audit-plan'
      }
    };
    const uploadResult = await s3.upload(params).promise();

    // 5. Create document record
    const document = await prisma.document.create({
      data: {
        title: documentTitle,
        description: `Comprehensive audit plan for ${auditPlan.audit.auditProgram.title} scheduled from ${formatDate(auditPlan.plannedStartDate)} to ${formatDate(auditPlan.plannedEndDate)}${versionNumber > 1 ? ` (Version ${versionNumber})` : ''}`,
        type: 'AUDIT_PLAN',
        status: 'DRAFT',
        tenantId,
        ownerId: userId,
        auditId: auditId,
      }
    });

    // 6. Create document version
    const version = await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        version: versionNumber,
        fileUrl: uploadResult.Location,
        s3Key: fileName,
        createdById: userId,
      }
    });

    // 7. Update document with current version
    await prisma.document.update({
      where: { id: document.id },
      data: { currentVersionId: version.id }
    });

    logger.info('Audit plan PDF generated successfully', { 
      auditId, 
      auditPlanId: auditPlan.id, 
      documentId: document.id,
      version: versionNumber 
    });

    return {
      message: versionNumber === 1 
        ? 'Audit plan PDF generated and saved successfully' 
        : `Audit plan PDF version ${versionNumber} generated and saved successfully`,
      document: {
        ...document,
        currentVersion: version
      }
    };
  } catch (error) {
    logger.error('Error generating audit plan PDF:', error);
    throw error;
  }
}

/**
 * Generate PDF document using PDFKit with professional layout
 */
async function generatePDFPlan(auditPlan) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 60,
          bottom: 60,
          left: 60,
          right: 60
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Define colors and layout constants
      const colors = {
        primary: '#2563EB',
        secondary: '#64748B',
        text: '#1F2937',
        light: '#F8FAFC',
        border: '#E2E8F0'
      };

      const pageWidth = doc.page.width - 120; // Account for margins
      let currentY = doc.y;

      // Header with professional styling
      drawHeaderBox(doc, colors, pageWidth);
      
      // Title section
      doc.fontSize(28).font('Times-Bold').fillColor(colors.primary)
        .text('AUDIT PLAN', { align: 'center' });
      doc.moveDown(0.8);
      
      doc.fontSize(18).font('Times-Roman').fillColor(colors.text)
        .text(auditPlan.title || 'Audit Plan', { align: 'center', width: pageWidth });
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Times-Roman').fillColor(colors.secondary)
        .text(`${getOrganizationName(auditPlan)} • Audit No: ${auditPlan.audit.auditNo}`, { align: 'center' });
      
      doc.moveDown(2);

      // 1. Executive Summary Box
      drawSectionHeader(doc, '1.0 EXECUTIVE SUMMARY', colors, pageWidth);
      drawInfoTable(doc, [
        ['Organization', getOrganizationName(auditPlan)],
        ['Audit Program', auditPlan.audit.auditProgram.title],
        ['Audit Type', formatAuditType(auditPlan.audit.type)],
        ['Planned Duration', `${formatDate(auditPlan.plannedStartDate)} to ${formatDate(auditPlan.plannedEndDate)}`],
        ['Team Size', `${auditPlan.audit.teamMembers?.length || 0} members`],
        ['Status', auditPlan.status]
      ], colors, pageWidth);

      doc.moveDown(1.5);

      // 2. Audit Framework
      drawSectionHeader(doc, '2.0 AUDIT FRAMEWORK', colors, pageWidth);

      // Objectives
      drawSubsectionHeader(doc, '2.1 Objectives', colors);
      if (auditPlan.objectives && auditPlan.objectives.length > 0) {
        drawBulletList(doc, auditPlan.objectives.map(obj => cleanTextForPDF(obj)), colors);
      } else {
        drawEmptyState(doc, 'No objectives specified', colors);
      }
      doc.moveDown(0.8);

      // Scope  
      drawSubsectionHeader(doc, '2.2 Scope', colors);
      if (auditPlan.scope && auditPlan.scope.length > 0) {
        drawBulletList(doc, auditPlan.scope.map(item => cleanTextForPDF(item)), colors);
      } else {
        drawEmptyState(doc, 'No scope specified', colors);
      }
      doc.moveDown(0.8);

      // Criteria
      drawSubsectionHeader(doc, '2.3 Criteria', colors);
      if (auditPlan.criteria && auditPlan.criteria.length > 0) {
        drawBulletList(doc, auditPlan.criteria.map(criterion => cleanTextForPDF(criterion)), colors);
      } else {
        drawEmptyState(doc, 'No criteria specified', colors);
      }
      doc.moveDown(0.8);

      // Methods
      drawSubsectionHeader(doc, '2.4 Methods', colors);
      if (auditPlan.methods && auditPlan.methods.length > 0) {
        drawBulletList(doc, auditPlan.methods.map(method => cleanTextForPDF(method)), colors);
      } else {
        drawEmptyState(doc, 'No methods specified', colors);
      }

      // 3. Audit Team - New Page
      doc.addPage();
      drawSectionHeader(doc, '3.0 AUDIT TEAM', colors, pageWidth);
      
      if (auditPlan.audit.teamMembers && auditPlan.audit.teamMembers.length > 0) {
        const teamData = auditPlan.audit.teamMembers.map(member => [
          `${member.user.firstName} ${member.user.lastName}`,
          member.role === 'TEAM_LEADER' ? 'Team Leader' : 'Auditor',
          member.user.email
        ]);
        drawTeamTable(doc, teamData, colors, pageWidth);
      } else {
        drawEmptyState(doc, 'No team members assigned', colors);
      }

      doc.moveDown(1.5);

      // 4. Audit Timetable - Major improvement here
      drawSectionHeader(doc, '4.0 AUDIT TIMETABLE', colors, pageWidth);
      
      if (auditPlan.timetable && Array.isArray(auditPlan.timetable) && auditPlan.timetable.length > 0) {
        drawTimetableTable(doc, auditPlan.timetable, colors, pageWidth);
      } else {
        drawEmptyState(doc, 'No timetable specified', colors);
      }

      // 5. Requirements & Notes
      if (auditPlan.requirements || auditPlan.notes) {
        doc.addPage();
        drawSectionHeader(doc, '5.0 REQUIREMENTS & NOTES', colors, pageWidth);

        if (auditPlan.requirements) {
          drawSubsectionHeader(doc, '5.1 Requirements', colors);
          drawTextBox(doc, cleanTextForPDF(auditPlan.requirements), colors, pageWidth);
          doc.moveDown(1);
        }

        if (auditPlan.notes) {
          drawSubsectionHeader(doc, '5.2 Notes', colors);
          drawTextBox(doc, cleanTextForPDF(auditPlan.notes), colors, pageWidth);
        }
      }

      // 6. Approval Section
      doc.addPage();
      drawSectionHeader(doc, '6.0 APPROVALS', colors, pageWidth);
      drawApprovalSection(doc, auditPlan, colors, pageWidth);

      // Footer
      addFooter(doc, auditPlan, colors, pageWidth);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Professional drawing helper functions
function drawHeaderBox(doc, colors, pageWidth) {
  doc.rect(60, 60, pageWidth, 60)
     .fillAndStroke(colors.light, colors.border)
     .fillColor(colors.text);
  doc.moveDown(1);
}

function drawSectionHeader(doc, title, colors, pageWidth) {
  const y = doc.y;
  doc.rect(60, y, pageWidth, 25)
     .fillAndStroke(colors.primary, colors.primary);
  
  doc.fontSize(14).font('Times-Bold').fillColor('white')
     .text(title, 70, y + 8);
  doc.moveDown(1.2);
  doc.fillColor(colors.text);
}

function drawSubsectionHeader(doc, title, colors) {
  doc.fontSize(12).font('Times-Bold').fillColor(colors.primary)
     .text(title);
  doc.moveDown(0.5);
  doc.fillColor(colors.text);
}

function drawInfoTable(doc, data, colors, pageWidth) {
  const tableY = doc.y;
  const rowHeight = 20;
  const leftColWidth = pageWidth * 0.3;
  const rightColWidth = pageWidth * 0.7;

  data.forEach((row, index) => {
    const y = tableY + (index * rowHeight);
    
    // Alternating row colors
    if (index % 2 === 0) {
      doc.rect(60, y, pageWidth, rowHeight)
         .fillAndStroke(colors.light, colors.border);
    } else {
      doc.rect(60, y, pageWidth, rowHeight)
         .stroke(colors.border);
    }

    // Labels
    doc.fontSize(11).font('Times-Bold').fillColor(colors.text)
       .text(row[0], 70, y + 6, { width: leftColWidth - 20 });
    
    // Values
    doc.fontSize(11).font('Times-Roman').fillColor(colors.text)
       .text(row[1], 70 + leftColWidth, y + 6, { width: rightColWidth - 20 });
  });

  doc.y = tableY + (data.length * rowHeight) + 10;
}

function drawBulletList(doc, items, colors) {
  items.forEach((item, index) => {
    doc.fontSize(11).font('Times-Roman').fillColor(colors.text)
       .text(`• ${item}`, { indent: 20, paragraphGap: 5 });
  });
}

function drawEmptyState(doc, message, colors) {
  doc.fontSize(11).font('Times-Italic').fillColor(colors.secondary)
     .text(message, { indent: 20 });
}

function drawTeamTable(doc, teamData, colors, pageWidth) {
  const tableY = doc.y;
  const rowHeight = 25;
  const colWidths = [pageWidth * 0.4, pageWidth * 0.25, pageWidth * 0.35];

  // Header
  doc.rect(60, tableY, pageWidth, rowHeight)
     .fillAndStroke(colors.primary, colors.primary);
  
  doc.fontSize(11).font('Times-Bold').fillColor('white')
     .text('Name', 70, tableY + 8, { width: colWidths[0] })
     .text('Role', 70 + colWidths[0], tableY + 8, { width: colWidths[1] })
     .text('Email', 70 + colWidths[0] + colWidths[1], tableY + 8, { width: colWidths[2] });

  // Data rows  
  teamData.forEach((row, index) => {
    const y = tableY + ((index + 1) * rowHeight);
    
    if (index % 2 === 0) {
      doc.rect(60, y, pageWidth, rowHeight)
         .fillAndStroke(colors.light, colors.border);
    } else {
      doc.rect(60, y, pageWidth, rowHeight)
         .stroke(colors.border);
    }

    doc.fontSize(10).font('Times-Roman').fillColor(colors.text)
       .text(row[0], 70, y + 8, { width: colWidths[0] - 10 })
       .text(row[1], 70 + colWidths[0], y + 8, { width: colWidths[1] - 10 })
       .text(row[2], 70 + colWidths[0] + colWidths[1], y + 8, { width: colWidths[2] - 10 });
  });

  doc.y = tableY + ((teamData.length + 1) * rowHeight) + 10;
}

function drawTimetableTable(doc, timetable, colors, pageWidth) {
  const tableY = doc.y;
  const rowHeight = 30;
  const colWidths = [pageWidth * 0.15, pageWidth * 0.35, pageWidth * 0.25, pageWidth * 0.25];

  // Header with better styling
  doc.rect(60, tableY, pageWidth, rowHeight)
     .fillAndStroke(colors.primary, colors.primary);
  
  doc.fontSize(11).font('Times-Bold').fillColor('white')
     .text('Time', 70, tableY + 10, { width: colWidths[0], align: 'center' })
     .text('Activity', 70 + colWidths[0], tableY + 10, { width: colWidths[1], align: 'center' })
     .text('Participants', 70 + colWidths[0] + colWidths[1], tableY + 10, { width: colWidths[2], align: 'center' })
     .text('Location', 70 + colWidths[0] + colWidths[1] + colWidths[2], tableY + 10, { width: colWidths[3], align: 'center' });

  // Data rows with proper formatting
  timetable.forEach((item, index) => {
    const y = tableY + ((index + 1) * rowHeight);
    
    // Check if we need a new page
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      const newY = doc.y;
      // Redraw header on new page
      doc.rect(60, newY, pageWidth, rowHeight)
         .fillAndStroke(colors.primary, colors.primary);
      doc.fontSize(11).font('Times-Bold').fillColor('white')
         .text('Time', 70, newY + 10, { width: colWidths[0], align: 'center' })
         .text('Activity', 70 + colWidths[0], newY + 10, { width: colWidths[1], align: 'center' })
         .text('Participants', 70 + colWidths[0] + colWidths[1], newY + 10, { width: colWidths[2], align: 'center' })
         .text('Location', 70 + colWidths[0] + colWidths[1] + colWidths[2], newY + 10, { width: colWidths[3], align: 'center' });
      doc.y = newY + rowHeight;
      return;
    }

    // Alternating row colors
    if (index % 2 === 0) {
      doc.rect(60, y, pageWidth, rowHeight)
         .fillAndStroke(colors.light, colors.border);
    } else {
      doc.rect(60, y, pageWidth, rowHeight)
         .stroke(colors.border);
    }

    // Format time properly
    const timeText = item.startTime ? formatTime(item.startTime) : (item.time || item.from || '');
    const activityText = item.title || item.activity || '';
    const participantsText = Array.isArray(item.participants) 
      ? item.participants.join(', ') 
      : (item.participants || '');
    const locationText = item.location || '';

    doc.fontSize(10).font('Times-Roman').fillColor(colors.text)
       .text(timeText, 70, y + 10, { width: colWidths[0] - 10, align: 'center' })
       .text(activityText, 70 + colWidths[0], y + 8, { width: colWidths[1] - 10 })
       .text(participantsText, 70 + colWidths[0] + colWidths[1], y + 8, { width: colWidths[2] - 10 })
       .text(locationText, 70 + colWidths[0] + colWidths[1] + colWidths[2], y + 8, { width: colWidths[3] - 10 });
  });

  doc.y = tableY + ((timetable.length + 1) * rowHeight) + 15;
}

function drawTextBox(doc, text, colors, pageWidth) {
  const boxY = doc.y;
  const textHeight = doc.heightOfString(text, { width: pageWidth - 40 });
  const boxHeight = textHeight + 20;

  doc.rect(60, boxY, pageWidth, boxHeight)
     .fillAndStroke(colors.light, colors.border);
  
  doc.fontSize(11).font('Times-Roman').fillColor(colors.text)
     .text(text, 70, boxY + 10, { width: pageWidth - 40 });
  
  doc.y = boxY + boxHeight + 10;
}

function drawApprovalSection(doc, auditPlan, colors, pageWidth) {
  const teamLeader = auditPlan.audit.teamMembers?.find(tm => tm.role === 'TEAM_LEADER')?.user;
  
  if (teamLeader) {
    doc.fontSize(12).font('Times-Bold').fillColor(colors.text)
       .text('Prepared by:');
    doc.fontSize(11).font('Times-Roman')
       .text(`${teamLeader.firstName} ${teamLeader.lastName}`)
       .text('Team Leader');
    doc.moveDown(0.5);
    doc.text('Signature: ________________________________     Date: ________________');
    doc.moveDown(1.5);
  }

  doc.fontSize(12).font('Times-Bold')
     .text('Approved by:');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Times-Roman')
     .text('Signature: ________________________________     Date: ________________');
  doc.text('Audit Manager');
}

function addFooter(doc, auditPlan, colors, pageWidth) {
  doc.moveDown(2);
  doc.fontSize(9).font('Times-Italic').fillColor(colors.secondary)
     .text(`Generated on ${formatDate(new Date())} by ${auditPlan.createdBy.firstName} ${auditPlan.createdBy.lastName}`, 
           { align: 'center' });
}

function formatTime(timeString) {
  if (!timeString) return '';
  try {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch (error) {
    return timeString;
  }
}

// Helper functions
function getOrganizationName(auditPlan) {
  return auditPlan.audit.auditProgram.tenant.legalName || 
         auditPlan.audit.auditProgram.tenant.name || 
         'Not specified';
}

function formatAuditType(type) {
  if (!type) return 'Standard Audit';
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(date) {
  if (!date) return 'Not specified';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Remove the old addInfoSection function as it's replaced by drawInfoTable

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
  
  return decoded.trim().replace(/\s+/g, ' ');
}

module.exports = {
  generateAuditPlanPdf
};