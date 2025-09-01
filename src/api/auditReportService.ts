// No imports needed for this service

const BACKEND_BASE_URL = 'https://dualdauth.onrender.com';

export interface AuditReportData {
  audit: {
    id: string;
    auditNo: number;
    type: string;
    auditDateFrom: string;
    auditDateTo: string;
    objectives: string[];
    scope: string[];
    criteria: string;
    teamMembers: Array<{
      user: {
        firstName: string;
        lastName: string;
      };
      role: string;
    }>;
  };
  auditProgram: {
    title: string;
  };
  findings: Array<{
    id: string;
    title: string;
    description: string;
    category: 'POSITIVE' | 'OBSERVATION' | 'NONCONFORMITY';
    department: string;
    severity?: string;
    correctiveAction?: string;
    dueDate?: string;
  }>;
  meetings: {
    opening?: {
      attendees: Array<{
        firstName: string;
        lastName: string;
      }>;
      agenda: Array<{
        item: string;
        discussed: boolean;
      }>;
    };
    closing?: {
      attendees: Array<{
        firstName: string;
        lastName: string;
      }>;
      agenda: Array<{
        item: string;
        discussed: boolean;
      }>;
    };
  };
  auditPlan?: {
    activities: Array<{
      timeFrom: string;
      timeTo: string;
      activity: string;
      responsibility: string;
    }>;
  };
  conclusion?: string;
  auditorsOpinion?: string;
}

export interface AuditReportResponse {
  document: {
    id: string;
    title: string;
    url: string;
  };
}

export interface CategorizationStatus {
  categorizationStatus: {
    categorized: boolean;
    totalFindings: number;
    categorizedFindings: number;
  };
  canGenerateFull: boolean;
  canGeneratePartial: boolean;
}

// Get categorization status for an audit
export const getCategorizationStatus = async (auditId: string, accessToken: string): Promise<CategorizationStatus> => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/audits/${auditId}/categorization-status`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching categorization status:', error);
    throw error;
  }
};

// Generate partial audit report (for categorized findings only)
export const generatePartialReport = async (
  auditId: string, 
  includeUncategorized: boolean, 
  accessToken: string
): Promise<AuditReportResponse> => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/audits/${auditId}/reports/partial`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includeUncategorized
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating partial report:', error);
    throw error;
  }
};

// Generate full audit report (all findings)
export const generateAuditReport = async (auditId: string, accessToken: string): Promise<AuditReportResponse> => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/audits/${auditId}/reports/full`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error generating full audit report:', error);
    throw error;
  }
};

// Preview audit report data (for testing)
export const previewAuditReportData = async (auditId: string, accessToken: string): Promise<AuditReportData> => {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/audits/${auditId}/reports/preview`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error previewing audit report data:', error);
    throw error;
  }
}; 