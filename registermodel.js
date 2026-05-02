const db = require("./test-db");

/* ========= CREATE TABLE ========= */
const createregisterTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_register (
      userid     INT AUTO_INCREMENT PRIMARY KEY,
      full_name  VARCHAR(255),
      email      VARCHAR(255) UNIQUE,
      password   VARCHAR(255),
      role       ENUM('user', 'admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  try {
    await db.query(sql);
    console.log("Register_user table ready ✅");
  } catch (err) {
    console.error("Table creation error ❌", err);
  }
};

/* ========= INSERT USER ========= */
const createNewUser = async (userData) => {
  const sql = `
    INSERT INTO user_register (full_name, email, password)
    VALUES (?, ?, ?)
  `;
  const [result] = await db.query(sql, [userData.fullName, userData.email, userData.password]);
  return result;
};

module.exports = { createregisterTable, createNewUser };