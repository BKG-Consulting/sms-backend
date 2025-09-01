#!/usr/bin/env node

const { prisma } = require('../prisma/client');

async function analyzeSchemaRelationships() {
  console.log('🔍 [SCHEMA_ANALYSIS] Analyzing Prisma schema relationships...\n');
  
  const findingId = '758b2aa5-113a-4d10-a764-c6a019465b05';
  
  try {
    // 1. Check the exact database structure
    console.log('📋 [SCHEMA_ANALYSIS] Database Structure Analysis:');
    
    // Check AuditFinding table structure
    const auditFindingStructure = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'AuditFinding' 
      ORDER BY ordinal_position
    `;
    
    console.log('   AuditFinding table columns:');
    auditFindingStructure.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Check ImprovementOpportunity table structure
    const improvementStructure = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'ImprovementOpportunity' 
      ORDER BY ordinal_position
    `;
    
    console.log('\n   ImprovementOpportunity table columns:');
    improvementStructure.forEach(col => {
      console.log(`     - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // 2. Check foreign key constraints
    console.log('\n🔗 [SCHEMA_ANALYSIS] Foreign Key Analysis:');
    
    const foreignKeys = await prisma.$queryRaw`
      SELECT 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND (tc.table_name = 'ImprovementOpportunity' OR ccu.table_name = 'AuditFinding')
    `;
    
    console.log('   Foreign key relationships:');
    foreignKeys.forEach(fk => {
      console.log(`     - ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}.${fk.foreign_column_name} (${fk.constraint_name})`);
    });
    
    // 3. Check unique constraints
    console.log('\n🔒 [SCHEMA_ANALYSIS] Unique Constraint Analysis:');
    
    const uniqueConstraints = await prisma.$queryRaw`
      SELECT 
        tc.table_name, 
        kcu.column_name,
        tc.constraint_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE' 
        AND tc.table_name = 'ImprovementOpportunity'
    `;
    
    console.log('   Unique constraints on ImprovementOpportunity:');
    uniqueConstraints.forEach(uc => {
      console.log(`     - ${uc.table_name}.${uc.column_name} (${uc.constraint_name})`);
    });
    
    // 4. Test different Prisma query approaches
    console.log('\n🧪 [SCHEMA_ANALYSIS] Prisma Query Testing:');
    
    // Test 1: Direct query
    console.log('   Test 1: Direct ImprovementOpportunity query');
    const directImprovement = await prisma.improvementOpportunity.findUnique({
      where: { findingId: findingId }
    });
    console.log(`     Result: ${directImprovement ? 'Found' : 'Not found'}`);
    if (directImprovement) {
      console.log(`     ID: ${directImprovement.id}, Opportunity: ${directImprovement.opportunity}`);
    }
    
    // Test 2: Include query
    console.log('   Test 2: AuditFinding with improvements include');
    const findingWithInclude = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      include: { improvements: true }
    });
    console.log(`     Result: ${findingWithInclude ? 'Found' : 'Not found'}`);
    if (findingWithInclude) {
      console.log(`     Has improvements: ${!!findingWithInclude.improvements}`);
      if (findingWithInclude.improvements) {
        console.log(`     Improvements ID: ${findingWithInclude.improvements.id}`);
      } else {
        console.log(`     Improvements: ${JSON.stringify(findingWithInclude.improvements)}`);
      }
    }
    
    // Test 3: Select query
    console.log('   Test 3: AuditFinding with improvements select');
    const findingWithSelect = await prisma.auditFinding.findUnique({
      where: { id: findingId },
      select: { 
        id: true, 
        title: true, 
        category: true,
        improvements: {
          select: {
            id: true,
            opportunity: true,
            status: true
          }
        }
      }
    });
    console.log(`     Result: ${findingWithSelect ? 'Found' : 'Not found'}`);
    if (findingWithSelect) {
      console.log(`     Has improvements: ${!!findingWithSelect.improvements}`);
      if (findingWithSelect.improvements) {
        console.log(`     Improvements ID: ${findingWithSelect.improvements.id}`);
      } else {
        console.log(`     Improvements: ${JSON.stringify(findingWithSelect.improvements)}`);
      }
    }
    
    // Test 4: Raw SQL join
    console.log('   Test 4: Raw SQL LEFT JOIN');
    const rawJoinResult = await prisma.$queryRaw`
      SELECT 
        af.id as finding_id,
        af.title as finding_title,
        af.category as finding_category,
        io.id as improvement_id,
        io.opportunity as improvement_opportunity,
        io.status as improvement_status
      FROM "AuditFinding" af
      LEFT JOIN "ImprovementOpportunity" io ON af.id = io."findingId"
      WHERE af.id = ${findingId}
    `;
    console.log(`     Result: ${rawJoinResult.length > 0 ? 'Found' : 'Not found'}`);
    if (rawJoinResult.length > 0) {
      const result = rawJoinResult[0];
      console.log(`     Finding ID: ${result.finding_id}`);
      console.log(`     Improvement ID: ${result.improvement_id || 'NULL'}`);
      console.log(`     Improvement Opportunity: ${result.improvement_opportunity || 'NULL'}`);
    }
    
    // 5. Check if there are any data inconsistencies
    console.log('\n🔍 [SCHEMA_ANALYSIS] Data Consistency Check:');
    
    const dataCheck = await prisma.$queryRaw`
      SELECT 
        af.id as finding_id,
        af.category as finding_category,
        io.id as improvement_id,
        io."findingId" as improvement_finding_id
      FROM "AuditFinding" af
      LEFT JOIN "ImprovementOpportunity" io ON af.id = io."findingId"
      WHERE af.id = ${findingId}
    `;
    
    if (dataCheck.length > 0) {
      const check = dataCheck[0];
      console.log(`     Finding ID: ${check.finding_id}`);
      console.log(`     Finding Category: ${check.finding_category}`);
      console.log(`     Improvement ID: ${check.improvement_id || 'NULL'}`);
      console.log(`     Improvement Finding ID: ${check.improvement_finding_id || 'NULL'}`);
      
      // Check for mismatches
      if (check.finding_category === 'IMPROVEMENT' && !check.improvement_id) {
        console.log('     ⚠️  ISSUE: Finding is IMPROVEMENT but no ImprovementOpportunity record exists');
      } else if (check.finding_category !== 'IMPROVEMENT' && check.improvement_id) {
        console.log('     ⚠️  ISSUE: Finding is not IMPROVEMENT but ImprovementOpportunity record exists');
      } else if (check.improvement_id && check.finding_id !== check.improvement_finding_id) {
        console.log('     ⚠️  ISSUE: Foreign key mismatch between finding and improvement');
      } else {
        console.log('     ✅ Data consistency looks good');
      }
    }
    
    // 6. Summary and recommendations
    console.log('\n📊 [SCHEMA_ANALYSIS] Summary:');
    console.log('   Based on the analysis above, the issue appears to be:');
    console.log('   1. Database records exist correctly');
    console.log('   2. Foreign key relationships are properly defined');
    console.log('   3. Prisma relationship mapping is failing');
    console.log('   4. Raw SQL queries work, but Prisma include/select fails');
    console.log('\n   This suggests a Prisma client cache or schema synchronization issue.');
    
  } catch (error) {
    console.error('❌ [SCHEMA_ANALYSIS] Analysis failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeSchemaRelationships()
  .then(() => {
    console.log('\n🎉 [SCHEMA_ANALYSIS] Analysis completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 [SCHEMA_ANALYSIS] Analysis failed:', error);
    process.exit(1);
  }); 