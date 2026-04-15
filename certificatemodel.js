const db = require("./test-db");

const createCertificatesTable = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS certificates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      certificate_id VARCHAR(255) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL,
      learner_name VARCHAR(255),
      course_name VARCHAR(255),
      issue_date DATE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email) REFERENCES user_register(email) ON DELETE CASCADE
    );
  `;

  db.query(sql, (err) => {
    if (err) {
      console.log("Certificates table creation error ❌", err);
    } else {
      console.log("Certificates table ready ✅");
    }
  });
};

const saveCertificate = (certificateData, cb) => {
  const { certificateId, email, learnerName, courseName } = certificateData;
  
  const sql = `
    INSERT INTO certificates (certificate_id, email, learner_name, course_name, issue_date)
    VALUES (?, ?, ?, ?, CURDATE())
    ON DUPLICATE KEY UPDATE
      learner_name = VALUES(learner_name),
      course_name = VALUES(course_name)
  `;

  db.query(sql, [certificateId, email, learnerName, courseName], cb);
};

const getCertificatesByEmail = (email, cb) => {
  const sql = "SELECT * FROM certificates WHERE email = ? ORDER BY issue_date DESC";
  db.query(sql, [email], cb);
};

const verifyCertificate = (certificateId, cb) => {
  const sql = "SELECT * FROM certificates WHERE certificate_id = ?";
  db.query(sql, [certificateId], cb);
};

module.exports = {
  createCertificatesTable,
  saveCertificate,
  getCertificatesByEmail,
  verifyCertificate
};
