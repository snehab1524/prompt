const db = require("./test-db");

/* ========= CREATE TABLE ========= */
const createUserTable = () => {
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

  db.query(sql, (err) => {
    if (err) {
      console.log("Table creation error ❌", err);
    } else {
      console.log("Users table ready ✅");
      // Run migration to add purchased_domains column if it doesn't exist
      migratePurchasedDomainsColumn();
    }
  });
};

// Migration: Add purchased_domains column if it doesn't exist
const migratePurchasedDomainsColumn = () => {
  const checkSql = "SHOW COLUMNS FROM users LIKE 'purchased_domains'";
  db.query(checkSql, (err, result) => {
    if (err) {
      console.log("Error checking purchased_domains column:", err);
      return;
    }
    if (result.length === 0) {
      // Column doesn't exist, add it
      const alterSql = "ALTER TABLE users ADD purchased_domains TEXT DEFAULT NULL";
      db.query(alterSql, (err) => {
        if (err) {
          console.log("Error adding purchased_domains column:", err);
        } else {
          console.log("✅ purchased_domains column added successfully via migration");
        }
      });
    } else {
      console.log("✅ purchased_domains column already exists");
    }
  });
};

/* ========= INSERT USER ========= */
const createUser = (userData) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO users 
      (full_name, email, phone, citizen, payment_verified, courseName, selected_domain, amount, duration, courseexpairy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
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
      ],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
};

module.exports = {
  createUserTable,
  createUser,
};
