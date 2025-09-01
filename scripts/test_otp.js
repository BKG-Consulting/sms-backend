const { sendOTP } = require('../src/utils/emailUtils'); // Correct path to emailUtils.js

(async () => {
  try {
    await sendOTP('greggambugua@gmail.com'); // Replace with a real test email
    console.log('Test OTP sent successfully');
  } catch (err) {
    console.error('Test failed:', err.message);
    console.error('Error details:', err);
  }
})();
