/**
 * Audit Program Domain Permissions
 * 
 * This file defines all permissions related to the Audit Program domain.
 * Each permission follows the pattern: module:action
 * 
 * Module: auditProgram
 * Actions: create, read, update, delete, commit, approve, reject, export, manage
 */

const AUDIT_PROGRAM_PERMISSIONS = {
  // Core CRUD Operations
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    requiredFor: ['Creating audit programs from scratch'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:read': {
    id: 'audit-program-read',
    module: 'auditProgram',
    action: 'read',
    description: 'View audit program details and list',
    category: 'Core Operations',
    requiredFor: ['Viewing audit program dashboard', 'Listing audit programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:update': {
    id: 'audit-program-update',
    module: 'auditProgram',
    action: 'update',
    description: 'Edit audit program details',
    category: 'Core Operations',
    requiredFor: ['Modifying audit program title, objectives, or other details'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:delete': {
    id: 'audit-program-delete',
    module: 'auditProgram',
    action: 'delete',
    description: 'Delete audit programs (only DRAFT status)',
    category: 'Core Operations',
    requiredFor: ['Removing audit programs that are still in draft'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Workflow Operations
  'auditProgram:commit': {
    id: 'audit-program-commit',
    module: 'auditProgram',
    action: 'commit',
    description: 'Commit audit program for review',
    category: 'Workflow',
    requiredFor: ['Submitting audit program for approval'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:approve': {
    id: 'audit-program-approve',
    module: 'auditProgram',
    action: 'approve',
    description: 'Approve committed audit programs',
    category: 'Workflow',
    requiredFor: ['Approving audit programs for execution'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  'auditProgram:reject': {
    id: 'audit-program-reject',
    module: 'auditProgram',
    action: 'reject',
    description: 'Reject committed audit programs',
    category: 'Workflow',
    requiredFor: ['Rejecting audit programs with comments'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Advanced Operations
  'auditProgram:export': {
    id: 'audit-program-export',
    module: 'auditProgram',
    action: 'export',
    description: 'Export audit program data',
    category: 'Advanced Operations',
    requiredFor: ['Downloading audit program reports', 'Data export'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:manage': {
    id: 'audit-program-manage',
    module: 'auditProgram',
    action: 'manage',
    description: 'Full management of audit programs',
    category: 'Advanced Operations',
    requiredFor: ['Complete control over audit program lifecycle'],
    roles: ['SYSTEM_ADMIN', 'MR']
  },
  
  // Audit Management within Programs
  'auditProgram:audit:create': {
    id: 'audit-program-audit-create',
    module: 'auditProgram',
    action: 'audit:create',
    description: 'Create audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Adding new audits to existing programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:read': {
    id: 'audit-program-audit-read',
    module: 'auditProgram',
    action: 'audit:read',
    description: 'View audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Viewing audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:audit:update': {
    id: 'audit-program-audit-update',
    module: 'auditProgram',
    action: 'audit:update',
    description: 'Edit audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Modifying audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:delete': {
    id: 'audit-program-audit-delete',
    module: 'auditProgram',
    action: 'audit:delete',
    description: 'Delete audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Removing audits from programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Team Management
  'auditProgram:team:manage': {
    id: 'audit-program-team-manage',
    module: 'auditProgram',
    action: 'team:manage',
    description: 'Manage audit team members',
    category: 'Team Management',
    requiredFor: ['Assigning team members to audits'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  // Planning Meetings
  'auditProgram:meeting:create': {
    id: 'audit-program-meeting-create',
    module: 'auditProgram',
    action: 'meeting:create',
    description: 'Create planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Scheduling planning meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:read': {
    id: 'audit-program-meeting-read',
    module: 'auditProgram',
    action: 'meeting:read',
    description: 'View planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Viewing meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:meeting:update': {
    id: 'audit-program-meeting-update',
    module: 'auditProgram',
    action: 'meeting:update',
    description: 'Edit planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Modifying meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:delete': {
    id: 'audit-program-meeting-delete',
    module: 'auditProgram',
    action: 'meeting:delete',
    description: 'Delete planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Canceling or removing meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  }
};

// Permission categories for UI organization
const AUDIT_PROGRAM_PERMISSION_CATEGORIES = {
  'Core Operations': [
    'auditProgram:create',
    'auditProgram:read', 
    'auditProgram:update',
    'auditProgram:delete'
  ],
  'Workflow': [
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject'
  ],
  'Advanced Operations': [
    'auditProgram:export',
    'auditProgram:manage'
  ],
  'Audit Management': [
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete'
  ],
  'Team Management': [
    'auditProgram:team:manage'
  ],
  'Meeting Management': [
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ]
};

// Default role permissions for audit program domain
const AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS = {
  'SYSTEM_ADMIN': Object.keys(AUDIT_PROGRAM_PERMISSIONS), // All permissions
  'MR': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:manage',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'PRINCIPAL': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'HOD': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:commit',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update'
  ],
  'AUDITOR': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'STAFF': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'ADMIN': [
    'auditProgram:read',
    'auditProgram:export'
  ]
};

module.exports = {
  AUDIT_PROGRAM_PERMISSIONS,
  AUDIT_PROGRAM_PERMISSION_CATEGORIES,
  AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS
}; 
 * Audit Program Domain Permissions
 * 
 * This file defines all permissions related to the Audit Program domain.
 * Each permission follows the pattern: module:action
 * 
 * Module: auditProgram
 * Actions: create, read, update, delete, commit, approve, reject, export, manage
 */

const AUDIT_PROGRAM_PERMISSIONS = {
  // Core CRUD Operations
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    requiredFor: ['Creating audit programs from scratch'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:read': {
    id: 'audit-program-read',
    module: 'auditProgram',
    action: 'read',
    description: 'View audit program details and list',
    category: 'Core Operations',
    requiredFor: ['Viewing audit program dashboard', 'Listing audit programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:update': {
    id: 'audit-program-update',
    module: 'auditProgram',
    action: 'update',
    description: 'Edit audit program details',
    category: 'Core Operations',
    requiredFor: ['Modifying audit program title, objectives, or other details'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:delete': {
    id: 'audit-program-delete',
    module: 'auditProgram',
    action: 'delete',
    description: 'Delete audit programs (only DRAFT status)',
    category: 'Core Operations',
    requiredFor: ['Removing audit programs that are still in draft'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Workflow Operations
  'auditProgram:commit': {
    id: 'audit-program-commit',
    module: 'auditProgram',
    action: 'commit',
    description: 'Commit audit program for review',
    category: 'Workflow',
    requiredFor: ['Submitting audit program for approval'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:approve': {
    id: 'audit-program-approve',
    module: 'auditProgram',
    action: 'approve',
    description: 'Approve committed audit programs',
    category: 'Workflow',
    requiredFor: ['Approving audit programs for execution'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  'auditProgram:reject': {
    id: 'audit-program-reject',
    module: 'auditProgram',
    action: 'reject',
    description: 'Reject committed audit programs',
    category: 'Workflow',
    requiredFor: ['Rejecting audit programs with comments'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Advanced Operations
  'auditProgram:export': {
    id: 'audit-program-export',
    module: 'auditProgram',
    action: 'export',
    description: 'Export audit program data',
    category: 'Advanced Operations',
    requiredFor: ['Downloading audit program reports', 'Data export'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:manage': {
    id: 'audit-program-manage',
    module: 'auditProgram',
    action: 'manage',
    description: 'Full management of audit programs',
    category: 'Advanced Operations',
    requiredFor: ['Complete control over audit program lifecycle'],
    roles: ['SYSTEM_ADMIN', 'MR']
  },
  
  // Audit Management within Programs
  'auditProgram:audit:create': {
    id: 'audit-program-audit-create',
    module: 'auditProgram',
    action: 'audit:create',
    description: 'Create audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Adding new audits to existing programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:read': {
    id: 'audit-program-audit-read',
    module: 'auditProgram',
    action: 'audit:read',
    description: 'View audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Viewing audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:audit:update': {
    id: 'audit-program-audit-update',
    module: 'auditProgram',
    action: 'audit:update',
    description: 'Edit audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Modifying audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:delete': {
    id: 'audit-program-audit-delete',
    module: 'auditProgram',
    action: 'audit:delete',
    description: 'Delete audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Removing audits from programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Team Management
  'auditProgram:team:manage': {
    id: 'audit-program-team-manage',
    module: 'auditProgram',
    action: 'team:manage',
    description: 'Manage audit team members',
    category: 'Team Management',
    requiredFor: ['Assigning team members to audits'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  // Planning Meetings
  'auditProgram:meeting:create': {
    id: 'audit-program-meeting-create',
    module: 'auditProgram',
    action: 'meeting:create',
    description: 'Create planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Scheduling planning meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:read': {
    id: 'audit-program-meeting-read',
    module: 'auditProgram',
    action: 'meeting:read',
    description: 'View planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Viewing meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:meeting:update': {
    id: 'audit-program-meeting-update',
    module: 'auditProgram',
    action: 'meeting:update',
    description: 'Edit planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Modifying meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:delete': {
    id: 'audit-program-meeting-delete',
    module: 'auditProgram',
    action: 'meeting:delete',
    description: 'Delete planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Canceling or removing meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  }
};

// Permission categories for UI organization
const AUDIT_PROGRAM_PERMISSION_CATEGORIES = {
  'Core Operations': [
    'auditProgram:create',
    'auditProgram:read', 
    'auditProgram:update',
    'auditProgram:delete'
  ],
  'Workflow': [
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject'
  ],
  'Advanced Operations': [
    'auditProgram:export',
    'auditProgram:manage'
  ],
  'Audit Management': [
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete'
  ],
  'Team Management': [
    'auditProgram:team:manage'
  ],
  'Meeting Management': [
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ]
};

// Default role permissions for audit program domain
const AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS = {
  'SYSTEM_ADMIN': Object.keys(AUDIT_PROGRAM_PERMISSIONS), // All permissions
  'MR': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:manage',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'PRINCIPAL': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'HOD': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:commit',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update'
  ],
  'AUDITOR': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'STAFF': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'ADMIN': [
    'auditProgram:read',
    'auditProgram:export'
  ]
};

module.exports = {
  AUDIT_PROGRAM_PERMISSIONS,
  AUDIT_PROGRAM_PERMISSION_CATEGORIES,
  AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS
}; 
 * Audit Program Domain Permissions
 * 
 * This file defines all permissions related to the Audit Program domain.
 * Each permission follows the pattern: module:action
 * 
 * Module: auditProgram
 * Actions: create, read, update, delete, commit, approve, reject, export, manage
 */

const AUDIT_PROGRAM_PERMISSIONS = {
  // Core CRUD Operations
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    requiredFor: ['Creating audit programs from scratch'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:read': {
    id: 'audit-program-read',
    module: 'auditProgram',
    action: 'read',
    description: 'View audit program details and list',
    category: 'Core Operations',
    requiredFor: ['Viewing audit program dashboard', 'Listing audit programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:update': {
    id: 'audit-program-update',
    module: 'auditProgram',
    action: 'update',
    description: 'Edit audit program details',
    category: 'Core Operations',
    requiredFor: ['Modifying audit program title, objectives, or other details'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:delete': {
    id: 'audit-program-delete',
    module: 'auditProgram',
    action: 'delete',
    description: 'Delete audit programs (only DRAFT status)',
    category: 'Core Operations',
    requiredFor: ['Removing audit programs that are still in draft'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Workflow Operations
  'auditProgram:commit': {
    id: 'audit-program-commit',
    module: 'auditProgram',
    action: 'commit',
    description: 'Commit audit program for review',
    category: 'Workflow',
    requiredFor: ['Submitting audit program for approval'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:approve': {
    id: 'audit-program-approve',
    module: 'auditProgram',
    action: 'approve',
    description: 'Approve committed audit programs',
    category: 'Workflow',
    requiredFor: ['Approving audit programs for execution'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  'auditProgram:reject': {
    id: 'audit-program-reject',
    module: 'auditProgram',
    action: 'reject',
    description: 'Reject committed audit programs',
    category: 'Workflow',
    requiredFor: ['Rejecting audit programs with comments'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Advanced Operations
  'auditProgram:export': {
    id: 'audit-program-export',
    module: 'auditProgram',
    action: 'export',
    description: 'Export audit program data',
    category: 'Advanced Operations',
    requiredFor: ['Downloading audit program reports', 'Data export'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:manage': {
    id: 'audit-program-manage',
    module: 'auditProgram',
    action: 'manage',
    description: 'Full management of audit programs',
    category: 'Advanced Operations',
    requiredFor: ['Complete control over audit program lifecycle'],
    roles: ['SYSTEM_ADMIN', 'MR']
  },
  
  // Audit Management within Programs
  'auditProgram:audit:create': {
    id: 'audit-program-audit-create',
    module: 'auditProgram',
    action: 'audit:create',
    description: 'Create audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Adding new audits to existing programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:read': {
    id: 'audit-program-audit-read',
    module: 'auditProgram',
    action: 'audit:read',
    description: 'View audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Viewing audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:audit:update': {
    id: 'audit-program-audit-update',
    module: 'auditProgram',
    action: 'audit:update',
    description: 'Edit audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Modifying audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:delete': {
    id: 'audit-program-audit-delete',
    module: 'auditProgram',
    action: 'audit:delete',
    description: 'Delete audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Removing audits from programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Team Management
  'auditProgram:team:manage': {
    id: 'audit-program-team-manage',
    module: 'auditProgram',
    action: 'team:manage',
    description: 'Manage audit team members',
    category: 'Team Management',
    requiredFor: ['Assigning team members to audits'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  // Planning Meetings
  'auditProgram:meeting:create': {
    id: 'audit-program-meeting-create',
    module: 'auditProgram',
    action: 'meeting:create',
    description: 'Create planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Scheduling planning meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:read': {
    id: 'audit-program-meeting-read',
    module: 'auditProgram',
    action: 'meeting:read',
    description: 'View planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Viewing meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:meeting:update': {
    id: 'audit-program-meeting-update',
    module: 'auditProgram',
    action: 'meeting:update',
    description: 'Edit planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Modifying meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:delete': {
    id: 'audit-program-meeting-delete',
    module: 'auditProgram',
    action: 'meeting:delete',
    description: 'Delete planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Canceling or removing meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  }
};

// Permission categories for UI organization
const AUDIT_PROGRAM_PERMISSION_CATEGORIES = {
  'Core Operations': [
    'auditProgram:create',
    'auditProgram:read', 
    'auditProgram:update',
    'auditProgram:delete'
  ],
  'Workflow': [
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject'
  ],
  'Advanced Operations': [
    'auditProgram:export',
    'auditProgram:manage'
  ],
  'Audit Management': [
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete'
  ],
  'Team Management': [
    'auditProgram:team:manage'
  ],
  'Meeting Management': [
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ]
};

// Default role permissions for audit program domain
const AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS = {
  'SYSTEM_ADMIN': Object.keys(AUDIT_PROGRAM_PERMISSIONS), // All permissions
  'MR': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:manage',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'PRINCIPAL': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'HOD': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:commit',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update'
  ],
  'AUDITOR': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'STAFF': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'ADMIN': [
    'auditProgram:read',
    'auditProgram:export'
  ]
};

module.exports = {
  AUDIT_PROGRAM_PERMISSIONS,
  AUDIT_PROGRAM_PERMISSION_CATEGORIES,
  AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS
}; 
 * Audit Program Domain Permissions
 * 
 * This file defines all permissions related to the Audit Program domain.
 * Each permission follows the pattern: module:action
 * 
 * Module: auditProgram
 * Actions: create, read, update, delete, commit, approve, reject, export, manage
 */

const AUDIT_PROGRAM_PERMISSIONS = {
  // Core CRUD Operations
  'auditProgram:create': {
    id: 'audit-program-create',
    module: 'auditProgram',
    action: 'create',
    description: 'Create new audit programs',
    category: 'Core Operations',
    requiredFor: ['Creating audit programs from scratch'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:read': {
    id: 'audit-program-read',
    module: 'auditProgram',
    action: 'read',
    description: 'View audit program details and list',
    category: 'Core Operations',
    requiredFor: ['Viewing audit program dashboard', 'Listing audit programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:update': {
    id: 'audit-program-update',
    module: 'auditProgram',
    action: 'update',
    description: 'Edit audit program details',
    category: 'Core Operations',
    requiredFor: ['Modifying audit program title, objectives, or other details'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:delete': {
    id: 'audit-program-delete',
    module: 'auditProgram',
    action: 'delete',
    description: 'Delete audit programs (only DRAFT status)',
    category: 'Core Operations',
    requiredFor: ['Removing audit programs that are still in draft'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Workflow Operations
  'auditProgram:commit': {
    id: 'audit-program-commit',
    module: 'auditProgram',
    action: 'commit',
    description: 'Commit audit program for review',
    category: 'Workflow',
    requiredFor: ['Submitting audit program for approval'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:approve': {
    id: 'audit-program-approve',
    module: 'auditProgram',
    action: 'approve',
    description: 'Approve committed audit programs',
    category: 'Workflow',
    requiredFor: ['Approving audit programs for execution'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  'auditProgram:reject': {
    id: 'audit-program-reject',
    module: 'auditProgram',
    action: 'reject',
    description: 'Reject committed audit programs',
    category: 'Workflow',
    requiredFor: ['Rejecting audit programs with comments'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Advanced Operations
  'auditProgram:export': {
    id: 'audit-program-export',
    module: 'auditProgram',
    action: 'export',
    description: 'Export audit program data',
    category: 'Advanced Operations',
    requiredFor: ['Downloading audit program reports', 'Data export'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:manage': {
    id: 'audit-program-manage',
    module: 'auditProgram',
    action: 'manage',
    description: 'Full management of audit programs',
    category: 'Advanced Operations',
    requiredFor: ['Complete control over audit program lifecycle'],
    roles: ['SYSTEM_ADMIN', 'MR']
  },
  
  // Audit Management within Programs
  'auditProgram:audit:create': {
    id: 'audit-program-audit-create',
    module: 'auditProgram',
    action: 'audit:create',
    description: 'Create audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Adding new audits to existing programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:read': {
    id: 'audit-program-audit-read',
    module: 'auditProgram',
    action: 'audit:read',
    description: 'View audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Viewing audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:audit:update': {
    id: 'audit-program-audit-update',
    module: 'auditProgram',
    action: 'audit:update',
    description: 'Edit audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Modifying audit details within programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:audit:delete': {
    id: 'audit-program-audit-delete',
    module: 'auditProgram',
    action: 'audit:delete',
    description: 'Delete audits within audit programs',
    category: 'Audit Management',
    requiredFor: ['Removing audits from programs'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  },
  
  // Team Management
  'auditProgram:team:manage': {
    id: 'audit-program-team-manage',
    module: 'auditProgram',
    action: 'team:manage',
    description: 'Manage audit team members',
    category: 'Team Management',
    requiredFor: ['Assigning team members to audits'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  // Planning Meetings
  'auditProgram:meeting:create': {
    id: 'audit-program-meeting-create',
    module: 'auditProgram',
    action: 'meeting:create',
    description: 'Create planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Scheduling planning meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:read': {
    id: 'audit-program-meeting-read',
    module: 'auditProgram',
    action: 'meeting:read',
    description: 'View planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Viewing meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD', 'AUDITOR', 'STAFF']
  },
  
  'auditProgram:meeting:update': {
    id: 'audit-program-meeting-update',
    module: 'auditProgram',
    action: 'meeting:update',
    description: 'Edit planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Modifying meeting details and agendas'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL', 'HOD']
  },
  
  'auditProgram:meeting:delete': {
    id: 'audit-program-meeting-delete',
    module: 'auditProgram',
    action: 'meeting:delete',
    description: 'Delete planning meetings',
    category: 'Meeting Management',
    requiredFor: ['Canceling or removing meetings'],
    roles: ['SYSTEM_ADMIN', 'MR', 'PRINCIPAL']
  }
};

// Permission categories for UI organization
const AUDIT_PROGRAM_PERMISSION_CATEGORIES = {
  'Core Operations': [
    'auditProgram:create',
    'auditProgram:read', 
    'auditProgram:update',
    'auditProgram:delete'
  ],
  'Workflow': [
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject'
  ],
  'Advanced Operations': [
    'auditProgram:export',
    'auditProgram:manage'
  ],
  'Audit Management': [
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete'
  ],
  'Team Management': [
    'auditProgram:team:manage'
  ],
  'Meeting Management': [
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ]
};

// Default role permissions for audit program domain
const AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS = {
  'SYSTEM_ADMIN': Object.keys(AUDIT_PROGRAM_PERMISSIONS), // All permissions
  'MR': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:manage',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'PRINCIPAL': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:delete',
    'auditProgram:commit',
    'auditProgram:approve',
    'auditProgram:reject',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:audit:delete',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update',
    'auditProgram:meeting:delete'
  ],
  'HOD': [
    'auditProgram:create',
    'auditProgram:read',
    'auditProgram:update',
    'auditProgram:commit',
    'auditProgram:export',
    'auditProgram:audit:create',
    'auditProgram:audit:read',
    'auditProgram:audit:update',
    'auditProgram:team:manage',
    'auditProgram:meeting:create',
    'auditProgram:meeting:read',
    'auditProgram:meeting:update'
  ],
  'AUDITOR': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'STAFF': [
    'auditProgram:read',
    'auditProgram:audit:read',
    'auditProgram:meeting:read'
  ],
  'ADMIN': [
    'auditProgram:read',
    'auditProgram:export'
  ]
};

module.exports = {
  AUDIT_PROGRAM_PERMISSIONS,
  AUDIT_PROGRAM_PERMISSION_CATEGORIES,
  AUDIT_PROGRAM_DEFAULT_ROLE_PERMISSIONS
}; 