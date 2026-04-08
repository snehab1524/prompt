const mysql = require("mysql2");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const db = mysql.createConnection({
  host: process.env.DB_HOST,//"localhost",
  user: process.env.DB_USER,//"root",
  password: process.env.DB_PASSWORD,//"Mahima@24",
  database: "cert_db",
  port: process.env.DB_PORT || 3306
});

db.connect((err) => {
  if (err) {
    console.log("DB connection failed ❌");
    console.log(err);
    return;
  }
  console.log("MySQL Connected ✅");
});
module.exports=db;

