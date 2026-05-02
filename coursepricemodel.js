const db = require("./test-db");

const priceTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_name VARCHAR(255) NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      duration INT NOT NULL
    )
  `;

  try {
    await db.query(sql);
    console.log("✅ Courses table ready");
  } catch (err) {
    console.error("❌ Error creating courses table:", err.message);
  }
};

module.exports = { priceTable };