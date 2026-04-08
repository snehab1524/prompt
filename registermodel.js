const db=require("./test-db");

const createregisterTable=()=>{
    const sql = 
    `CREATE TABLE IF NOT EXISTS user_register(
     userid INT AUTO_INCREMENT PRIMARY KEY,
     full_name VARCHAR(255), 
     email VARCHAR(255) UNIQUE ,
     password VARCHAR(255),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`

   db.query(sql, (err) => {
        if (err) {
            console.log("Table creation error ❌", err);
        } else {
            console.log("Register_user table ready ✅");
        }
    });
}

/* ========= INSERT USER ========= */
const createNewUser = (userData) => {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO user_register
      (full_name, email, password)
      VALUES (?, ?, ?)
    `;

    db.query(
      sql,
      [
        userData.fullName,
        userData.email,
        userData.password,
      ],
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
  });
};



module.exports={createregisterTable,createNewUser }