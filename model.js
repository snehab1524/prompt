const db = require("./test-db");

/* ========= CREATE TABLE ========= */
const createUserTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(100),
      email VARCHAR(100),
      phone VARCHAR(20),
      citizen VARCHAR(55) DEFAULT null,
      payment_verified VARCHAR(55) DEFAULT "NO Payment",
      courseName VARCHAR(255) DEFAULT "NO COURSE",
      selected_domain VARCHAR(55) DEFAULT NULL,
      purchased_domains TEXT DEFAULT NULL,
      amount DECIMAL(10,2) DEFAULT 0.0,
      duration INT DEFAULT NULL,
      courseexpairy DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    await db.query(sql);
    console.log("Users table ready âœ…");
    // Run migration to add purchased_domains column if it doesn't exist
    await migratePurchasedDomainsColumn();
  } catch (err) {
    console.log("Table creation error âŒ", err);
  }
};

// Migration: Add purchased_domains column if it doesn't exist
const migratePurchasedDomainsColumn = async () => {
  const checkSql = "SHOW COLUMNS FROM users LIKE 'purchased_domains'";

  try {
    const [result] = await db.query(checkSql);
    if (result.length === 0) {
      // Column doesn't exist, add it
      const alterSql = "ALTER TABLE users ADD purchased_domains TEXT DEFAULT NULL";

      try {
        await db.query(alterSql);
        console.log("âœ… purchased_domains column added successfully via migration");
      } catch (err) {
        console.log("Error adding purchased_domains column:", err);
      }
    } else {
      console.log("âœ… purchased_domains column already exists");
    }
  } catch (err) {
    console.log("Error checking purchased_domains column:", err);
  }
};

/* ========= INSERT USER ========= */
const createUser = async (userData) => {
  const sql = `
    INSERT INTO users 
    (full_name, email, phone, citizen, payment_verified, courseName, selected_domain, amount, duration, courseexpairy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const [result] = await db.query(sql, [
    userData.fullName,
    userData.email,
    userData.phone,
    userData.citizen,
    userData.paymentVerified,
    userData.courseName || "NO COURSE",
    userData.selectedDomain || null,
    userData.amount,
    userData.duration,
    userData.courseexpairy
  ]);

  return result;
};

module.exports = {
  createUserTable,
  createUser,
};
