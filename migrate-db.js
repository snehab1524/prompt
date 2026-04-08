const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const mysql = require("mysql");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("❌ DB Connection Error:", err);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL");

  // Step 1: Drop old certificate table if exists
  db.query("DROP TABLE IF EXISTS certificates", (err) => {
    if (err) {
      console.error("❌ Error dropping old certificates table:", err);
    } else {
      console.log("✅ Removed old certificates table (if existed)");
    }

    // Step 2: Ensure user_progress table exists with correct schema
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_progress(
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        completedLevels JSON,
        currentLevelId VARCHAR(255),
        certifications JSON,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );
    `;

    db.query(createTableSQL, (err) => {
      if (err) {
        console.error("❌ Error creating user_progress table:", err);
      } else {
        console.log("✅ user_progress table ready with correct schema");
      }

      // Step 3: Verify table structure
      db.query("DESC user_progress", (err, results) => {
        if (err) {
          console.error("❌ Error describing table:", err);
        } else {
          console.log("\n✅ Current user_progress table structure:");
          console.table(results);
        }

        // Step 4: Show sample data
        db.query("SELECT * FROM user_progress LIMIT 1", (err, results) => {
          if (err) {
            console.error("❌ Error reading sample data:", err);
          } else if (results.length > 0) {
            console.log("\n✅ Sample user_progress record:");
            console.log(JSON.stringify(results[0], null, 2));
          } else {
            console.log("\n⚠️  No records in user_progress table yet");
          }

          db.end();
          console.log("\n✅ Migration complete!");
        });
      });
    });
  });
});
