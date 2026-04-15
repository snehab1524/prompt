const bcrypt = require('bcrypt');
const db = require('./test-db');
const userRegister = require('./registermodel');

async function createAdmin() {
  try {
const adminData = {
      fullName: 'Admin User',
      email: 'admin@aiinsight.com',
      password: await bcrypt.hash('admin123', 15),
      role: 'admin'
    };

    // Check if exists
    db.query('SELECT * FROM user_register WHERE email = ?', [adminData.email], async (err, rows) => {
      if (rows.length > 0) {
        console.log('✅ Admin already exists');
        process.exit(0);
      } else {
        // Create
        const result = await userRegister.createNewUser(adminData);
        console.log('✅ Admin created successfully:', result);
        process.exit(0);
      }
    });
  } catch (err) {
    console.error('❌ Error creating admin:', err);
    process.exit(1);
  }
}

createAdmin();
