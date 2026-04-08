const db = require('./test-db');

console.log("🔍 Checking database state for user progress...\n");

db.query('SELECT email, completedLevels, certifications FROM user_progress', (err, result) => {
  if (err) {
    console.error('❌ DB Error:', err);
    process.exit(1);
  }

  if (!result || result.length === 0) {
    console.log('❌ No user progress found in database');
    process.exit(0);
  }

  console.log(`📊 Found ${result.length} user(s):\n`);
  result.forEach((row, idx) => {
    const completedLevels = typeof row.completedLevels === 'string' 
      ? JSON.parse(row.completedLevels) 
      : row.completedLevels;
    
    const certifications = typeof row.certifications === 'string' 
      ? JSON.parse(row.certifications) 
      : row.certifications;
    
    const hasAdvanced = completedLevels.filter(l => l.includes('advanced-'));
    
    console.log(`[User ${idx + 1}]`);
    console.log(`  Email: ${row.email}`);
    console.log(`  Completed Levels: ${JSON.stringify(completedLevels, null, 2)}`);
    console.log(`  Advanced Levels Found: ${hasAdvanced.length > 0 ? hasAdvanced.join(', ') : 'None'}`);
    console.log(`  Certifications: ${JSON.stringify(certifications, null, 2)}`);
    console.log('---\n');
  });

  process.exit(0);
});
