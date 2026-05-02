const mysql = require("mysql2");

// ❌ REMOVE dotenv for production (Render doesn't use .env file)
// require("dotenv").config();

const db = mysql.createPool({
  host: process.env.MYSQLHOST,        // Railway variable
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000
});

// Test connection (safe)
db.getConnection((err, connection) => {
  if (err) {
    console.log("❌ DB connection failed:");
    console.log(err.message);
  } else {
    console.log("✅ MySQL Connected");
    connection.release();
  }
});

module.exports = db.promise();