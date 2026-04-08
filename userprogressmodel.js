const db = require("./test-db");

const createuserprogress = () => {
  const sql = `
    CREATE TABLE IF NOT EXISTS user_progress(
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      completedLevels JSON,
      currentLevelId VARCHAR(255),
      certifications JSON,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP 
      ON UPDATE CURRENT_TIMESTAMP
    );
  `;

  db.query(sql, (err) => {
    if (err) {
      console.log("Table creation error ❌", err);
    } else {
      console.log("User_progress table ready ✅");
    }
  });
};

const saveProgress = (email, progress, cb) => {
  getProgress(email, (err, existingRows) => {
    if (err) return cb(err);

    // ✅ SAFE PARSE EXISTING LEVELS
    let existingCompleted = [];
    if (existingRows && existingRows.length > 0) {
      const data = existingRows[0].completedLevels;

      if (Array.isArray(data)) {
        existingCompleted = data;
      } else {
        try {
          existingCompleted = JSON.parse(data || "[]");
        } catch (e) {
          existingCompleted = [];
        }
      }
    }

    // ✅ PREREQUISITES MAP
    const prerequisites = {
      "content-writing": "beginner",
      "marketing": "beginner",
      "coding": "beginner",
      "data-analysis": "beginner",
      "education": "beginner",
      "business": "beginner",
      "fashion": "beginner",
      "health": "beginner",

      "advanced-content-writing": "content-writing",
      "advanced-marketing": "marketing",
      "advanced-coding": "coding",
      "advanced-data-analysis": "data-analysis",
      "advanced-education": "education",
      "advanced-business": "business",
      "advanced-fashion": "fashion",
      "advanced-health": "health"
    };

    const newLevels = progress.completedLevels || [];

    // ✅ ACCEPT ALL LEVELS - No prerequisite blocking
    // Frontend handles auto-unlock logic, backend just stores
    const validNewLevels = newLevels.filter((levelId) => levelId);

    // ✅ MERGE + REMOVE DUPLICATES
    const mergedCompleted = [
      ...new Set([...existingCompleted, ...validNewLevels])
    ];

    // ✅ CERTIFICATION MAP (OLD FORMAT - Object with id, levelName, date, learnerName)
    const certificationLabelMap = {
      beginner: "Beginner Prompting",
      "content-writing": "Content Writing Domain",
      marketing: "Marketing Prompt Crafting",
      coding: "Coding Prompt Engineering",
      "data-analysis": "Data Analysis Prompting",
      education: "Education Domain Mastery",
      business: "Business Prompt Strategy",
      fashion: "Fashion Industry Prompts",
      health: "Healthcare Prompt Expertise",

      "advanced-content-writing": "Advanced Content Writing",
      "advanced-marketing": "Advanced Marketing Prompts",
      "advanced-coding": "Advanced Coding Prompts",
      "advanced-data-analysis": "Advanced Data Analysis",
      "advanced-education": "Advanced Education",
      "advanced-business": "Advanced Business",
      "advanced-fashion": "Advanced Fashion",
      "advanced-health": "Advanced Health"
    };

    // ✅ GENERATE CERTIFICATIONS (Object Format - Old Style)
    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2, "0") + "/" + 
                    String(today.getMonth() + 1).padStart(2, "0") + "/" + 
                    today.getFullYear();

    const earnedCertifications = mergedCompleted.map((level) => {
      if (!certificationLabelMap[level]) return null;
      return {
        id: level,
        levelName: certificationLabelMap[level],
        date: dateStr,
        learnerName: progress.learnerName || "Learner"
      };
    }).filter(Boolean);

    // Remove duplicates (by id)
    const unique = {};
    earnedCertifications.forEach(cert => {
      if (!unique[cert.id]) {
        unique[cert.id] = cert;
      }
    });
    const uniqueCertifications = Object.values(unique);

    // ✅ QUERY
    const query = `
      INSERT INTO user_progress 
      (email, completedLevels, currentLevelId, certifications)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        completedLevels = ?,
        currentLevelId = ?,
        certifications = ?
    `;

    const completedLevelsStr = JSON.stringify(mergedCompleted);
    const certificationsStr = JSON.stringify(uniqueCertifications);

    db.query(
      query,
      [
        email,
        completedLevelsStr,
        progress.currentLevelId || null,
        certificationsStr,
        completedLevelsStr,
        progress.currentLevelId || null,
        certificationsStr
      ],
      (err, result) => {
        if (err) {
          console.log("Save error ❌", err);
          cb(err);
        } else {
          cb(null, {
            success: true,
            validatedLevels: validNewLevels,
            totalCompleted: mergedCompleted.length,
            certifications: uniqueCertifications
          });
        }
      }
    );
  });
};

const getProgress = (email, cb) => {
  db.query(
    "SELECT * FROM user_progress WHERE email = ?",
    [email],
    cb
  );
};

module.exports = {
  createuserprogress,
  saveProgress,
  getProgress
};