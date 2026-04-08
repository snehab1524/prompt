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

  db.query('SELECT certifications FROM user_progress WHERE email="snehabajaj41284@gmail.com"', (err, results) => {
    if (err) {
      console.error('Query error:', err);
      db.end();
      return;
    }

    if (results.length > 0) {
      console.log('Raw certifications JSON:', results[0].certifications);
      try {
        const parsed = JSON.parse(results[0].certifications);
        console.log('Parsed certifications:', parsed);
      } catch (parseErr) {
        console.error('Parse error:', parseErr);
      }
    } else {
      console.log('No results found');
    }

    db.end();
  });
});