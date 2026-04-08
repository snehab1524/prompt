const mysql = require('mysql2');
const db = require('./test-db');

const testSafeParse = (value, fallback = []) => {
  try {
    // If it's already an array/object, return as is
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      console.log('Value is already an object/array, returning as-is');
      return value;
    }
    // Otherwise try to parse as JSON string
    console.log('Value is not object/array, attempting to parse');
    return JSON.parse(value);
  } catch (e) {
    console.log('Parse failed:', e.message);
    return fallback;
  }
};

const userprogress = require('./userprogressmodel');

// Get progress using the actual function
userprogress.getProgress('snehabajaj41284@gmail.com', (err, result) => {
  if (err) {
    console.error('Error:', err);
    process.exit(1);
  }

  if (!result.length) {
    console.log('No results');
    process.exit(0);
  }

  const data = result[0];
  console.log('===== DEBUG get-progress endpoint =====');
  console.log('Raw data from DB:', data);
  console.log('\n===== PARSING COMPLETED LEVELS =====');
  const parsedCompletedLevels = testSafeParse(data.completedLevels);
  console.log('Parsed completedLevels:', parsedCompletedLevels);
  
  console.log('\n===== PARSING CERTIFICATIONS =====');
  const parsedCertifications = testSafeParse(data.certifications);
  console.log('Parsed certifications:', JSON.stringify(parsedCertifications, null, 2));

  console.log('\n===== FINAL RESPONSE =====');
  console.log(JSON.stringify({
    completedLevels: parsedCompletedLevels,
    currentLevelId: data.currentLevelId,
    certifications: parsedCertifications
  }, null, 2));

  process.exit(0);
});