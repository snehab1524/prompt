const db = require("./test-db");

const safeParse = (value, fallback = []) => {
  try {
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
      return value;
    }
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

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

    const existingRow = existingRows && existingRows.length > 0 ? existingRows[0] : null;
    const existingCompleted = safeParse(existingRow?.completedLevels || "[]");
    const existingCertifications = safeParse(existingRow?.certifications || "[]");

    const newLevels = progress.completedLevels || [];

    const validNewLevels = newLevels.filter((levelId) => levelId);

    const mergedCompleted = [
      ...new Set([...existingCompleted, ...validNewLevels])
    ];

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

    const today = new Date();
    const dateStr = String(today.getDate()).padStart(2, "0") + "/" + 
                    String(today.getMonth() + 1).padStart(2, "0") + "/" + 
                    today.getFullYear();

    const fallbackLearnerName = progress.learnerName || existingRow?.learnerName || "Learner";
    const certificationsById = {};

    existingCertifications.forEach((cert) => {
      if (cert && typeof cert === "object" && cert.id) {
        certificationsById[cert.id] = cert;
      }
    });

    (progress.certifications || []).forEach((cert) => {
      if (cert && typeof cert === "object" && cert.id) {
        certificationsById[cert.id] = {
          ...certificationsById[cert.id],
          ...cert,
          learnerName: cert.learnerName || certificationsById[cert.id]?.learnerName || fallbackLearnerName
        };
      }
    });

    mergedCompleted.forEach((level) => {
      if (!certificationLabelMap[level] || certificationsById[level]) return;
      certificationsById[level] = {
        id: level,
        levelName: certificationLabelMap[level],
        date: dateStr,
        learnerName: fallbackLearnerName
      };
    });

    const uniqueCertifications = Object.values(certificationsById);

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
