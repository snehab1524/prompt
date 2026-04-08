const db = require('./test-db');

const testEmail = 'snehabajaj41284@gmail.com';

const sql = `
INSERT INTO user_progress (email, completedLevels, currentLevelId, certifications) 
VALUES (?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  completedLevels = VALUES(completedLevels),
  currentLevelId = VALUES(currentLevelId),
  certifications = VALUES(certifications)
`;

const completedLevels = JSON.stringify(['beginner', 'content-writing']);
const currentLevelId = 'content-writing';
const certifications = JSON.stringify([
  {
    id: 'cert_beginner_123',
    levelName: 'Beginner Certificate',
    date: '2024-10-01',
    learnerName: 'Test User'
  },
  {
    id: 'cert_content_456', 
    levelName: 'Content Writing Certificate',
    date: '2024-10-02',
    learnerName: 'Test User'
  }
]);

db.query(sql, [testEmail, completedLevels, currentLevelId, certifications], (err, result) => {
  if (err) {
    console.error('❌ Insert failed:', err);
  } else {
    console.log('✅ Test row created/updated:', result.affectedRows, 'rows affected');
  }
  
  // Verify
  db.query("SELECT * FROM user_progress WHERE email = ?", [testEmail], (err, rows) => {
    if (err) console.error('Verify failed:', err);
    else {
      console.log('\\n📊 VERIFICATION:');
      console.log('Raw row:', JSON.stringify(rows[0], null, 2));
    }
    process.exit(0);
  });
});

