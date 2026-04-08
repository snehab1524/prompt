const db = require('./test-db');

console.log("🔧 Fixing database certificate format...\n");

const certificationMap = {
  beginner: "Beginner Certificate",
  "content-writing": "Content Writing Certificate",
  marketing: "Marketing Certificate",
  coding: "Coding Certificate",
  "data-analysis": "Data Analysis Certificate",
  education: "Education Certificate",
  business: "Business Certificate",
  fashion: "Fashion Certificate",
  health: "Health Certificate",

  "advanced-content-writing": "Advanced Content Writing Certificate",
  "advanced-marketing": "Advanced Marketing Certificate",
  "advanced-coding": "Advanced Coding Certificate",
  "advanced-data-analysis": "Advanced Data Analysis Certificate",
  "advanced-education": "Advanced Education Certificate",
  "advanced-business": "Advanced Business Certificate",
  "advanced-fashion": "Advanced Fashion Certificate",
  "advanced-health": "Advanced Health Certificate"
};

// First, fetch all users
db.query('SELECT id, email, completedLevels, certifications FROM user_progress', (err, users) => {
  if (err) {
    console.error('❌ Error fetching users:', err);
    process.exit(1);
  }

  console.log(`📊 Processing ${users.length} users...\n`);
  let fixedCount = 0;

  users.forEach((user, idx) => {
    try {
      // Parse completedLevels
      let completedLevels = user.completedLevels;
      if (typeof completedLevels === 'string') {
        completedLevels = JSON.parse(completedLevels);
      }

      // Parse certifications
      let certs = user.certifications;
      if (typeof certs === 'string') {
        try {
          certs = JSON.parse(certs);
        } catch (e) {
          certs = [];
        }
      }

      // Convert to clean string array format
      let certStrings = [];
      if (Array.isArray(certs)) {
        certStrings = certs.map(cert => {
          if (typeof cert === 'string') return cert;
          if (typeof cert === 'object' && cert.levelName) {
            // Old format - convert to new format
            return certificationMap[cert.id] || cert.levelName;
          }
          return null;
        }).filter(Boolean);
      }

      // Regenerate from scratch based on completedLevels (clean source of truth)
      const regeneratedCerts = completedLevels
        .map(level => certificationMap[level])
        .filter(Boolean);
      
      // Combine both sources to ensure nothing is lost
      const finalCerts = [...new Set([...certStrings, ...regeneratedCerts])];

      // Check if anything changed
      const oldCertsStr = JSON.stringify(certs);
      const newCertsStr = JSON.stringify(finalCerts);

      if (oldCertsStr !== newCertsStr) {
        console.log(`[${idx + 1}] ${user.email}`);
        console.log(`  Before: ${Array.isArray(certs) ? certs.length : 0} certs (format: ${typeof certs[0]} - ${Array.isArray(certs) && certs[0] ? Object.keys(certs[0])[0] : 'string'})`);
        console.log(`  After: ${finalCerts.length} certs (all strings)`);
        console.log(`  Certs: ${finalCerts.join(', ')}\n`);

        // Update database
        const finalCertsStr = JSON.stringify(finalCerts);
        db.query(
          'UPDATE user_progress SET certifications = ? WHERE id = ?',
          [finalCertsStr, user.id],
          (err) => {
            if (err) {
              console.error(`    ❌ Error updating ${user.email}:`, err);
            } else {
              fixedCount++;
              console.log(`    ✅ Updated successfully\n`);
            }
          }
        );
      }
    } catch (e) {
      console.error(`❌ Error processing user ${idx + 1}:`, e.message);
    }
  });

  // Give async updates time to complete
  setTimeout(() => {
    console.log(`\n✅ Database cleanup complete! Fixed ${fixedCount} records.`);
    process.exit(0);
  }, 2000);
});
