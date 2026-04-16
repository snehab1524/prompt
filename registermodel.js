const db = require("./test-db");

/* ========= CREATE TABLE ========= */
const createregisterTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_register(
      userid INT AUTO_INCREMENT PRIMARY KEY,
      full_name VARCHAR(255), 
      email VARCHAR(255) UNIQUE,
      password VARCHAR(255),
      role ENUM('user', 'admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      -- 🔥 INDEX for ultra fast login
      INDEX idx_email (email)
    );
  `;

  db.query(sql, (err) => {
    if (err) {
      console.log("❌ Table creation error:", err);
    } else {
      console.log("✅ user_register table ready (optimized)");
    }
  });
};

/* ========= INSERT USER ========= */
const createNewUser = (userData) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO user_register (full_name, email, password)
      VALUES (?, ?, ?)
    `;

    db.query(
      sql,
      [userData.fullName, userData.email, userData.password],
      (err, result) => {
        if (err) {
          // 🔥 Handle duplicate email properly
          if (err.code === "ER_DUP_ENTRY") {
            return reject(new Error("Email already registered"));
          }
          return reject(err);
        }

        resolve({
          userId: result.insertId,
          email: userData.email
        });
      }
    );
  });
};

module.exports = { createregisterTable, createNewUser };