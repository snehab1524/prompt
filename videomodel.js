const db = require("./test-db");

/* ========= CREATE TABLE ========= */

const createVideoTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS videos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      Title VARCHAR(100),
      video VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
db.query(sql, (err) => {
    if (err) {
      console.log("Table creation error ❌", err);
    } else {
      console.log("Users table ready ✅");
    }
  });
};

/* ========= INSERT USER ========= */

const storeVideo = (videoData) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO videos (Title, video)
      VALUES (?, ?)
    `;

    db.query(
      sql,
      [videoData.title, videoData.video],
      (err, result) => {
        if (err) {
          console.log("Video insert error ❌", err);
          reject(err);
        } else {
          resolve(result);
        }
      }
    );
  });
};

module.exports={createVideoTable,storeVideo}