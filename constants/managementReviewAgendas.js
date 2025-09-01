// Management Review Agendas
const MANAGEMENT_REVIEW_AGENDAS = [
  { key: 'min1', label: 'MIN 1: PRELIMINARIES', order: 1, isRequired: true },
  { key: 'min2', label: 'MIN 2: READING AND CONFIRMATION OF PREVIOUS MINUTES', order: 2, isRequired: true },
  { key: 'min3', label: 'MIN 3: MATTERS ARISING - FOLLOWUP ACTIONS FROM PREVIOUS MANAGEMENT REVIEW MEETING', order: 3, isRequired: true },
  { key: 'min4', label: 'MIN 4: REVIEW OF QUALITY POLICY AND OBJECTIVES', order: 4, isRequired: true },
  { key: 'min5', label: 'MIN 5: REVIEW OF ORGANIZATIONAL STRUCTURE AND RESOURCES', order: 5, isRequired: true },
  { key: 'min6', label: 'MIN 6: CUSTOMER FEEDBACK', order: 6, isRequired: true },
  { key: 'min7', label: 'MIN 7: STATUS OF RISK AND CORRECTIVE ACTION', order: 7, isRequired: true },
  { key: 'min8', label: 'MIN 8: CHANGES THAT COULD AFFECT THE MANAGEMENT SYSTEM', order: 8, isRequired: true },
  { key: 'min9', label: 'MIN 9: RECOMMENDATIONS FOR IMPROVEMENT', order: 9, isRequired: true },
  { key: 'min10', label: 'MIN 10: AOB', order: 10, isRequired: false },
];

const getAgendaByKey = (key) => {
  return MANAGEMENT_REVIEW_AGENDAS.find(agenda => agenda.key === key);
};

const getRequiredAgendas = () => {
  return MANAGEMENT_REVIEW_AGENDAS.filter(agenda => agenda.isRequired);
};

module.exports = {
  MANAGEMENT_REVIEW_AGENDAS,
  getAgendaByKey,
  getRequiredAgendas
}; 