const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'snehajiya',
  database: 'cert_db'
});

db.connect((err) => {
  if (err) {
    console.error('DB connection failed:', err);
    return;
  }
  console.log('Connected to database');

  db.query('SELECT email, completedLevels, certifications FROM user_progress WHERE email="snehabajaj41284@gmail.com"', (err, results) => {
    if (err) {
      console.error('Query error:', err);
      db.end();
      return;
    }

    if (results.length > 0) {
      const row = results[0];
      console.log('📧 Email:', row.email);
      console.log('Raw completedLevels type:', typeof row.completedLevels);
      console.log('Raw completedLevels value:', row.completedLevels);
      console.log('Raw certifications type:', typeof row.certifications);
      console.log('Raw certifications value:', row.certifications);
      console.log('\nColumn types from database:');
      console.log('completedLevels is Array?', Array.isArray(row.completedLevels));
      console.log('certifications is Array?', Array.isArray(row.certifications));
    } else {
      console.log('No results found');
    }

    db.end();
  });
});