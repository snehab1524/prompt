const db = require("./test-db");

const createPaymentdataTable = async () => {

    const sql=
    `CREATE TABLE IF NOT EXISTS payment_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255),
  courseName VARCHAR(255),
  razorpay_payment_id VARCHAR(255),
  razorpay_order_id VARCHAR(255),
  amount DECIMAL(10,2),
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    `
    try {
      await db.query(sql);
      console.log("Users table ready âœ…");
    } catch (err) {
      console.log("Table creation error âŒ", err);
    }
}
const createpaymentdatabase = async (userData) => {
  await db.query(
    `INSERT INTO payment_logs 
   (email, courseName, razorpay_payment_id, razorpay_order_id, amount)
   VALUES (?, ?, ?, ?, ?)`,
    [
      userData.email || "unknown",
      userData.courseName,
      userData.razorpay_payment_id,
      userData.razorpay_order_id,
      userData.amountResult
    ]
  );
}

module.exports={createPaymentdataTable,createpaymentdatabase }
