const db = require('./test-db');

console.log('🔧 Fixing role column...');

db.query("SHOW COLUMNS FROM user_register LIKE 'role'", (showErr, columns) => {
  if (showErr) throw showErr;
  if (columns.length === 0) {
    console.log('✅ Adding role column');
    db.query("ALTER TABLE user_register ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user'", (addErr) => {
      if (addErr) {
        console.error('❌ Add column failed:', addErr.message);
      } else {
        console.log('✅ Role column added');
      }
    });
  } else {
    console.log('✅ Role column already exists');
  }
  
  // Set admin role if exists
  db.query("UPDATE user_register SET role = 'admin' WHERE email = 'admin@aiinsight.com'", (updateErr) => {
    if (updateErr) {
      console.log('⚠️ No admin or update failed:', updateErr.message);
    } else {
      console.log('✅ Admin role set');
    }
    db.end();
  });
});

