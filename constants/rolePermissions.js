/**
 * Role Permissions Constants
 * 
 * This file defines available roles and their descriptions for the system.
 */

const REQUIRED_ROLES = [
  'TRAINEE', 'TRAINER', 'HOD', 'ADMIN', 'REGISTRAR', 'PRINCIPAL', 'STAFF', 'SUPER_ADMIN', 'MANAGEMENT_REP', 'AUDITOR',
];

// Extended list of available roles based on the system requirements
const AVAILABLE_ROLES = [
  'SYSTEM_ADMIN',
  'PRINCIPAL', 
  'HOD',
  'HOD_AUDITOR',
  'STAFF',
  'AUDITOR',
  'MR', // Management Representative
  'REGISTRAR',
  'TRAINER',
  'TRAINEE',
  'ADMIN'
];

// Role descriptions
const ROLE_DESCRIPTIONS = {
  'SYSTEM_ADMIN': 'System administrator with full access to all features',
  'PRINCIPAL': 'Principal with institutional oversight and management capabilities',
  'HOD': 'Head of Department with department-specific management',
  'HOD_AUDITOR': 'Head of Department with auditing capabilities',
  'STAFF': 'Staff member with basic access to institutional resources',
  'AUDITOR': 'Auditor with audit-specific permissions',
  'MR': 'Management Representative as Document Custodian and audit oversight',
  'REGISTRAR': 'Registrar with student and academic management',
  'TRAINER': 'Trainer with training and development capabilities',
  'TRAINEE': 'Trainee with limited access for learning purposes',
  'ADMIN': 'Administrator with management capabilities'
};

/**
 * Get list of available roles
 * @returns {string[]} Array of available role names
 */
const getAvailableRoles = () => {
  return AVAILABLE_ROLES;
};

/**
 * Get description for a specific role
 * @param {string} roleName - The name of the role
 * @returns {string} Description of the role or default message
 */
const getRoleDescription = (roleName) => {
  return ROLE_DESCRIPTIONS[roleName.toUpperCase()] || 'Custom role with configurable permissions';
};

module.exports = {
  REQUIRED_ROLES,
  AVAILABLE_ROLES,
  ROLE_DESCRIPTIONS,
  getAvailableRoles,
  getRoleDescription
};
