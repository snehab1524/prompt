const db = require('./test-db');

console.log('🔄 Adding admin role column to user_register table...');

db.query("SHOW COLUMNS FROM user_register LIKE 'role'", (showErr, columns) => {
  if (showErr) throw showErr;
  if (columns.length === 0) {
    db.query("ALTER TABLE user_register ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user'", (addErr, addResult) => {
      if (addErr) {
        console.error('❌ Add column failed:', addErr.message);
        process.exit(1);
      } else {
        console.log('✅ Role column added');
  if (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Role column added successfully');
    
    // Update existing admin user
    db.query(`
      UPDATE user_register 
      SET role = 'admin' 
      WHERE email = 'admin@aiinsight.com'
    `, (updateErr, updateResult) => {
      if (updateErr) {
        console.error('⚠️ Update admin role failed:', updateErr.message);
      } else {
        console.log('✅ Admin user role updated');
      }
      db.end();
      process.exit(0);
    });
  }
});

