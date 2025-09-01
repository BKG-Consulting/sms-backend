# Custom Audit Report Generation System

## Overview

This system provides a professional audit report generation solution that creates reports matching the exact format provided in your sample. The system uses Puppeteer for PDF generation and custom HTML templates for precise formatting control.

## Features

### 1. Professional Report Format
- **Exact Layout Matching**: Reports match your sample format exactly
- **ISO Standards Compliance**: Professional formatting following audit standards
- **Custom Styling**: Times New Roman font, proper spacing, and professional appearance
- **Structured Sections**: 1.0 General, 2.0 Summary, 3.0 Detailed Findings, 4.0 Annexes

### 2. Report Types
- **Full Audit Report**: Complete report with all findings and data
- **Partial Audit Report**: Report with only categorized findings
- **Flexible Generation**: Choose based on audit completion status

### 3. Automated Data Population
- **Audit Information**: Automatically pulls audit details, objectives, scope
- **Team Information**: Lists team members with roles
- **Findings Organization**: Groups findings by department and category
- **Meeting Details**: Includes opening/closing meeting attendance and agendas
- **Audit Plan**: Includes timetable and activities

### 4. Technical Implementation

#### Frontend Components
```typescript
// AuditReportGenerator.tsx
- Professional UI for report generation
- Progress tracking and status display
- Categorization status overview
- Report type selection
```

#### Backend API Endpoints
```typescript
// /api/audits/[auditId]/reports/full
- Generates complete audit reports
- Uses Puppeteer for PDF generation
- Saves to database with document tracking

// /api/audits/[auditId]/reports/partial  
- Generates partial reports (categorized findings only)
- Same professional formatting
- Flexible filtering options

// /api/audits/[auditId]/categorization-status
- Checks findings categorization status
- Determines report generation eligibility
```

#### Template Engine
```typescript
// auditReportTemplate.ts
- Custom HTML template matching your sample exactly
- Professional CSS styling
- Automated data population
- Responsive layout for different content lengths
```

## Report Structure

### 1.0 GENERAL
- Organization audited
- Audit dates
- Objectives (numbered list)
- Scope
- Audit criteria
- Audit team (with roles)
- Auditee representative

### 2.0 SUMMARY OF AUDIT
- Audit execution summary
- Findings statistics
- Meeting references
- Conclusion
- Auditors' opinion
- Team leader signature

### 3.0 DETAILED FINDINGS
- Organized by department
- Findings grouped by category:
  - POSITIVES
  - AREAS OF IMPROVEMENT (Observations)
  - NON CONFORMITIES
- Numbered lists for easy reference

### 4.0 ANNEXES
- 4.1 Audit plan (timetable)
- 4.2 Opening meeting attendance
- 4.3 Opening meeting agenda
- 4.4 Closing meeting attendance
- 4.5 Closing meeting agenda

## Installation & Setup

### Dependencies
```bash
npm install puppeteer handlebars
```

### Database Schema
The system requires the following data structure:
- Audits with objectives, scope, criteria
- Team members with roles
- Findings with categories and departments
- Meetings with attendance and agendas
- Audit plans with activities

### Configuration
```typescript
// Environment variables
BACKEND_BASE_URL=https://your-backend-url.com
```

## Usage

### 1. Generate Full Report
```typescript
import { generateAuditReport } from '@/api/auditReportService';

const result = await generateAuditReport(auditId, accessToken);
// Returns: { document: { id, title, url } }
```

### 2. Generate Partial Report
```typescript
import { generatePartialReport } from '@/api/auditReportService';

const result = await generatePartialReport(auditId, false, accessToken);
// Returns: { document: { id, title, url } }
```

### 3. Check Categorization Status
```typescript
import { getCategorizationStatus } from '@/api/auditReportService';

const status = await getCategorizationStatus(auditId, accessToken);
// Returns categorization and generation eligibility
```

## Customization

### Template Modifications
Edit `src/lib/auditReportTemplate.ts` to modify:
- Report layout and structure
- Styling and formatting
- Data organization
- Section content

### Styling Customization
The template uses CSS for styling:
```css
body {
    font-family: 'Times New Roman', serif;
    line-height: 1.6;
    font-size: 12pt;
}
```

### Data Mapping
Modify the data mapping in API endpoints to match your database schema:
```typescript
const reportData = {
  audit: { /* audit information */ },
  findings: { /* findings data */ },
  meetings: { /* meeting details */ },
  // ... other data
};
```

## Benefits

1. **Professional Appearance**: Reports look exactly like your sample
2. **Automated Generation**: No manual formatting required
3. **Consistent Output**: Same format every time
4. **Flexible Options**: Full or partial reports
5. **Easy Integration**: Works with existing audit system
6. **PDF Export**: Professional PDF output
7. **Database Integration**: Saves reports with metadata

## Future Enhancements

1. **Email Integration**: Send reports via email
2. **Digital Signatures**: Add digital signature support
3. **Multiple Formats**: Export to Word, Excel
4. **Report Templates**: Multiple template options
5. **Batch Generation**: Generate multiple reports
6. **Version Control**: Track report versions
7. **Approval Workflow**: Add approval process

## Support

For questions or customization requests, refer to the code comments and documentation in each file. The system is designed to be easily extensible and maintainable. 