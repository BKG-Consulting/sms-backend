// Closing Meeting Agendas
const closingMeetingAgendas = [
  "Introduction and Registration",
  "Thanking the Auditee",
  "Reconfirmation audit Objectives and scope and criteria",
  "Mention of principles of sampling followed in auditing",
  "Presentation of the findings - summary Positives, Observation and nonconformities in detail",
  "Presentation of conclusion and opinion",
  "Discussion on the findings",
  "Corrective action dates",
  "Follow up dates",
  "Reconfirmation of confidentiality"
];

const getClosingMeetingAgendas = () => [...closingMeetingAgendas];

module.exports = {
  closingMeetingAgendas,
  getClosingMeetingAgendas
}; 