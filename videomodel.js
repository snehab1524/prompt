const db = require("./test-db");

/* ========= CREATE TABLE ========= */

const createVideoTable = async () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      Title VARCHAR(100),
      video VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  try {
    await db.query(sql);
    console.log("Users table ready âœ…");
  } catch (err) {
    console.log("Table creation error âŒ", err);
  }
};

/* ========= INSERT USER ========= */

const storeVideo = async (videoData) => {
  const sql = `
    INSERT INTO videos (Title, video)
    VALUES (?, ?)
  `;

  try {
    const [result] = await db.query(sql, [videoData.title, videoData.video]);
    return result;
  } catch (err) {
    console.log("Video insert error âŒ", err);
    throw err;
  }
};

module.exports = { createVideoTable, storeVideo };
