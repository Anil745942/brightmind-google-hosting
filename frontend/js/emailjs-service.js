/* ===== GYANOLOGY - FRONTEND EMAILJS SERVICE =====
 * Sends emails directly from the browser using EmailJS SDK.
 * 1. Admin notification — tells you someone contacted Gyanology
 * 2. Auto-reply — thanks the user for reaching out
 *
 * How to set up on https://www.emailjs.com :
 *   1. Create a free account
 *   2. Add an Email Service (Gmail recommended) → copy SERVICE_ID
 *   3. Create TWO email templates:
 *      a) "Contact Notification" (for admin)  → copy TEMPLATE_ID
 *      b) "Auto Reply" (for user)             → copy TEMPLATE_ID
 *   4. Go to Account → General → copy your PUBLIC_KEY
 *   5. Paste all values below in EMAILJS_CONFIG
 */

const EMAILJS_CONFIG = {
  PUBLIC_KEY: 'nU6LhAfLTgeYuD_no',
  SERVICE_ID: 'service_430bzm2',
  TEMPLATE_ID_CONTACT: 'template_xojgs86',   // Admin notification template
  TEMPLATE_ID_REPLY: 'template_okb9mcs'       // Auto-reply template
};

/* ---------- Initialise EmailJS ---------- */
const EmailJSService = {
  _ready: false,

  init() {
    if (typeof emailjs === 'undefined') {
      console.warn('⚠️ EmailJS SDK not loaded. Email features disabled.');
      return;
    }
    try {
      emailjs.init({ publicKey: EMAILJS_CONFIG.PUBLIC_KEY });
      this._ready = true;
      console.log('✅ EmailJS (frontend) initialised');
    } catch (err) {
      console.error('❌ EmailJS init error:', err);
    }
  },

  isReady() {
    return this._ready;
  },

  /* ---------- Send admin notification ---------- */
  async sendAdminNotification({ name, email, subject, message }) {
    if (!this._ready) {
      console.warn('⚠️ EmailJS not ready — skipping admin notification');
      return { success: false, reason: 'EmailJS not initialised' };
    }

    const templateParams = {
      from_name: name,
      from_email: email,
      reply_to: email,
      subject: subject || 'General Inquiry',
      message: message,
      contact_date: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    try {
      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID_CONTACT,
        templateParams
      );
      console.log('✅ Admin notification sent:', response.status);
      return { success: true, status: response.status };
    } catch (err) {
      console.error('❌ Admin notification failed:', err);
      return { success: false, error: err?.text || err.toString() };
    }
  },

  /* ---------- Send auto-reply to user ---------- */
  async sendAutoReply({ name, email }) {
    if (!this._ready) {
      console.warn('⚠️ EmailJS not ready — skipping auto-reply');
      return { success: false, reason: 'EmailJS not initialised' };
    }

    const firstName = (name || 'Student').split(' ')[0];
    const templateParams = {
      to_email: email,
      user_email: email,
      recipient_email: email,
      to_name: firstName,
      user_name: firstName,
      reply_to: email,
      current_date: new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    try {
      const response = await emailjs.send(
        EMAILJS_CONFIG.SERVICE_ID,
        EMAILJS_CONFIG.TEMPLATE_ID_REPLY,
        templateParams
      );
      console.log('✅ Auto-reply sent to:', email, '| Status:', response.status);
      return { success: true, status: response.status };
    } catch (err) {
      console.error('❌ Auto-reply failed:', err);
      return { success: false, error: err?.text || err.toString() };
    }
  },

  /* ---------- Handle full contact flow ---------- */
  async handleContact(formData) {
    const results = {
      admin: { success: false },
      reply: { success: false }
    };

    // 1. Send notification to admin (you)
    results.admin = await this.sendAdminNotification(formData);

    // 2. Send auto-reply to the user
    results.reply = await this.sendAutoReply(formData);

    // Overall success if at least admin notification went through
    results.success = results.admin.success;
    return results;
  }
};

// Auto-initialise when script loads
document.addEventListener('DOMContentLoaded', () => {
  EmailJSService.init();
});
