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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  db.query(sql, (err) => {
    if (err) {
      console.log("❌ Table creation error:", err);
    } else {
      console.log("✅ user_register table ready");
      
      // 🔥 Create index separately (SAFE WAY)
      db.query(
        "CREATE INDEX IF NOT EXISTS idx_email ON user_register(email)",
        (err) => {
          if (err) {
            console.log("⚠️ Index creation issue:", err.message);
          } else {
            console.log("⚡ Email index ready");
          }
        }
      );
    }
  });
};

/* ========= INSERT USER ========= */
const createNewUser = (userData) => {
  return new Promise((resolve, reject) => {

    // 🔥 Validation (IMPORTANT)
    if (!userData.fullName || !userData.email || !userData.password) {
      return reject(new Error("All fields are required"));
    }

    const sql = `
      INSERT INTO user_register (full_name, email, password)
      VALUES (?, ?, ?)
    `;

    db.query(
      sql,
      [userData.fullName, userData.email, userData.password],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return reject(new Error("Email already registered"));
          }
          console.error("❌ Insert error:", err);
          return reject(err);
        }

        resolve({
          userId: result.insertId,
          fullName: userData.fullName,
          email: userData.email
        });
      }
    );
  });
};

module.exports = { createregisterTable, createNewUser };