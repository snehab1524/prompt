const twilio = require('twilio');

// Test Twilio SMS (replace with your creds)
const accountSid = process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

async function testSMS() {
  try {
    const message = await client.messages.create({
      body: '🧪 Twilio SMS test from AIINSIGHT - if received, SMS works!',
      from: process.env.TWILIO_PHONE,
      to: '+91YOUR_PHONE_NUMBER' // Replace
    });
    console.log('✅ SMS sent:', message.sid);
  } catch (err) {
    console.error('❌ SMS failed:', err);
  }
}

testSMS();
