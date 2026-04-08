const db=require('./test-db');

const priceTable=()=>{
    const sql =
    `CREATE TABLE IF NOT EXISTS courses(
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_name VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        duration INT NOT NULL
    )`
    db.query(sql,(err)=>{
        if(err){
            console.error("Error creating courses table:", err);
        } else {
            console.log("Courses table created or already exists");
        }
    })
}

module.exports={priceTable}