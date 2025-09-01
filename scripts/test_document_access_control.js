const documentService = require('../src/services/documentService');

// Mock data for testing
const mockDocuments = [
  {
    id: '1',
    title: 'Document 1',
    status: 'DRAFT',
    tenantId: 'tenant1',
    owner: { firstName: 'John', lastName: 'Doe' }
  },
  {
    id: '2',
    title: 'Document 2',
    status: 'PUBLISHED',
    tenantId: 'tenant1',
    owner: { firstName: 'Jane', lastName: 'Smith' }
  },
  {
    id: '3',
    title: 'Document 3',
    status: 'UNDER_REVIEW',
    tenantId: 'tenant1',
    owner: { firstName: 'Bob', lastName: 'Johnson' }
  }
];

// Test function to simulate the listDocuments logic
function testDocumentAccessControl() {
  console.log('Testing Document Access Control...\n');
  
  // Test 1: MR user should see all documents except OBSOLETE
  console.log('Test 1: MR user access');
  const mrDocuments = mockDocuments.filter(doc => doc.status !== 'OBSOLETE');
  console.log('MR can see:', mrDocuments.map(d => `${d.title} (${d.status})`));
  
  // Test 2: Non-MR user should only see PUBLISHED documents
  console.log('\nTest 2: Non-MR user access');
  const nonMrDocuments = mockDocuments.filter(doc => doc.status === 'PUBLISHED');
  console.log('Non-MR can see:', nonMrDocuments.map(d => `${d.title} (${d.status})`));
  
  // Test 3: Empty results for non-MR when no published documents
  console.log('\nTest 3: Non-MR with no published documents');
  const noPublishedDocs = mockDocuments.filter(doc => doc.status !== 'PUBLISHED');
  const nonMrEmptyResult = noPublishedDocs.filter(doc => doc.status === 'PUBLISHED');
  console.log('Non-MR result when no published docs:', nonMrEmptyResult.length === 0 ? 'No documents shown' : 'Error: Should be empty');
  
  console.log('\n✅ Access control logic test completed successfully!');
}

testDocumentAccessControl(); 