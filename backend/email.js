// ===== EMAIL SERVICE WITH EMAILJS =====
// Load environment variables
try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
} catch (err) {
  console.warn('dotenv not available or .env file not found');
}

// EmailJS credentials (set these as environment variables or in .env file)
const EMAIL_CONFIG = {
  SERVICE_ID: process.env.EMAILJS_SERVICE_ID || 'service_430bzm2',
  TEMPLATE_ID_CONTACT: process.env.EMAILJS_TEMPLATE_CONTACT || 'template_qxuamz5',
  TEMPLATE_ID_REPLY: process.env.EMAILJS_TEMPLATE_REPLY || 'template_hjghhl9',
  PUBLIC_KEY: process.env.EMAILJS_PUBLIC_KEY || 'nU6LhAfLTgeYuD_no',
  PRIVATE_KEY: process.env.EMAILJS_PRIVATE_KEY || ''
};

// Import EmailJS SDK
let emailjs;
try {
  emailjs = require('@emailjs/nodejs');
  const initOptions = {
    publicKey: EMAIL_CONFIG.PUBLIC_KEY,
  };
  if (EMAIL_CONFIG.PRIVATE_KEY) {
    initOptions.privateKey = EMAIL_CONFIG.PRIVATE_KEY;
  }

  emailjs.init(initOptions);
  console.log('✅ EmailJS initialized successfully');
  console.log('   Service ID:', EMAIL_CONFIG.SERVICE_ID);
  console.log('   Contact Template:', EMAIL_CONFIG.TEMPLATE_ID_CONTACT);
  console.log('   Reply Template:', EMAIL_CONFIG.TEMPLATE_ID_REPLY);
  console.log('   Private key loaded:', EMAIL_CONFIG.PRIVATE_KEY ? 'yes' : 'no');
} catch (err) {
  console.error('❌ EmailJS initialization failed:', err.message);
  emailjs = null;
}

// ===== SEND CONTACT NOTIFICATION TO ADMIN =====
const sendContactNotification = async (contactData) => {
  try {
    if (!emailjs) {
      console.warn('⚠️  EmailJS not available. Skipping admin notification.');
      return { success: true, message: 'Message saved (email service not available)' };
    }

    const { name, email, subject, message } = contactData;
    const adminEmail = process.env.ADMIN_EMAIL || 'contact@brightmind.local';

    const templateParams = {
      to_email: adminEmail,
      user_email: adminEmail,
      recipient_email: adminEmail,
      reply_to: email,
      from_name: name,
      from_email: email,
      subject: subject || 'General Inquiry',
      message: message,
      contact_date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    console.log('📧 Sending admin notification to:', adminEmail);
    console.log('   Template params:', JSON.stringify(templateParams, null, 2));

    const response = await emailjs.send(
      EMAIL_CONFIG.SERVICE_ID,
      EMAIL_CONFIG.TEMPLATE_ID_CONTACT,
      templateParams
    );

    console.log('✅ Admin notification sent successfully:', response);
    return { success: true, message: 'Notification sent to admin', response };
  } catch (err) {
    console.error('❌ Error sending admin notification:', err);
    console.error('   Error details:', err.message || err.toString());
    return { success: false, error: err.message || err.toString() };
  }
};

// ===== SEND AUTO-REPLY TO USER =====
const sendAutoReply = async (contactData) => {
  try {
    if (!emailjs) {
      console.warn('⚠️  EmailJS not available. Skipping auto-reply.');
      return { success: true, message: 'Auto-reply service not available' };
    }

    const { name, email } = contactData;

    const templateParams = {
      to_email: email,
      user_email: email,
      recipient_email: email,
      reply_to: email,
      user_name: name.split(' ')[0],
      current_date: new Date().toLocaleDateString('en-IN')
    };

    console.log('📧 Sending auto-reply to:', email);
    console.log('   Template params:', JSON.stringify(templateParams, null, 2));

    const response = await emailjs.send(
      EMAIL_CONFIG.SERVICE_ID,
      EMAIL_CONFIG.TEMPLATE_ID_REPLY,
      templateParams
    );

    console.log('✅ Auto-reply sent successfully:', response);
    return { success: true, message: 'Auto-reply sent to user', response };
  } catch (err) {
    console.error('❌ Error sending auto-reply:', err);
    console.error('   Error details:', err.message || err.toString());
    return { success: false, error: err.message || err.toString() };
  }
};

// ===== SEND BOTH EMAILS =====
const handleContactEmail = async (contactData) => {
  try {
    // Send notification to admin
    const adminResult = await sendContactNotification(contactData);

    // Send auto-reply to user
    const replyResult = await sendAutoReply(contactData);

    return {
      success: true,
      admin: adminResult,
      reply: replyResult
    };
  } catch (err) {
    console.error('Error in email handling:', err);
    return {
      success: false,
      error: err.message
    };
  }
};

module.exports = {
  handleContactEmail,
  sendContactNotification,
  sendAutoReply,
  EMAIL_CONFIG
};
