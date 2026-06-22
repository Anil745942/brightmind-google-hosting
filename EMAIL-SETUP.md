# 📧 Email Setup Guide - Contact Form Auto-Reply

## ✅ What's Been Set Up

Your contact form now sends:
1. **Admin Notification Email** - Contact details go to your email
2. **Auto-Reply Email** - Automatic response sent to the user
3. **Database Storage** - Contact saved to `backend/data/contacts.json`

## 🔧 Configuration

### Step 1: Update Admin Email

Edit `.env` file and replace `your-email@gmail.com` with your actual email:

```
ADMIN_EMAIL=your-actual-email@gmail.com
```

### Step 2: EmailJS Templates

Your templates are already configured:
- **Service ID**: `service_430bzm2`
- **Contact Template**: `template_qxuamz5` (sends to admin)
- **Reply Template**: `template_hjghhl9` (sends to user)
- **Public Key**: `nU6LhAfLTgeYuD_no`

These are linked in `.env` file and `backend/email.js`

### Step 3: Verify Templates

Make sure your EmailJS account has these templates set up with these variables:

**Contact Template** (`template_qxuamz5`):
```
{{to_email}}        - Admin email
{{from_name}}       - User's name
{{from_email}}      - User's email
{{subject}}         - Subject
{{message}}         - Message
{{contact_date}}    - Date/Time
```

**Reply Template** (`template_hjghhl9`):
```
{{to_email}}        - User's email
{{user_name}}       - User's first name
{{current_date}}    - Current date
```

## 🚀 How It Works

When user submits contact form at `http://localhost:3000/contact.html`:

```
1. Form data sent to /api/contact endpoint
2. Contact saved to contacts.json database
3. Email module sends:
   ✅ Admin notification (to ADMIN_EMAIL in .env)
   ✅ Auto-reply (to user's submitted email)
4. Response confirms both emails sent
```

## 📋 Files Created/Updated

- ✅ `backend/email.js` - Email service module
- ✅ `backend/server.js` - Updated contact endpoint
- ✅ `.env` - Email configuration (LOCAL)
- ✅ `.env.example` - Template for reference
- ✅ `package.json` - Added @emailjs/nodejs and dotenv

## 🧪 Testing

### Local Testing:

1. Start server: `node backend/server.js`
2. Open: `http://localhost:3000/contact.html`
3. Fill form and submit
4. Check:
   - Terminal for email logs
   - Your email inbox for admin notification
   - Junk/spam folder for auto-reply

### Production Testing:

After deploying to Google Cloud:
```
gcloud run deploy gyanology --source .
```

Emails will use the same templates automatically.

## 🔐 Environment Variables

### Local (.env file):
```
EMAILJS_SERVICE_ID=service_430bzm2
EMAILJS_TEMPLATE_CONTACT=template_qxuamz5
EMAILJS_TEMPLATE_REPLY=template_hjghhl9
EMAILJS_PUBLIC_KEY=nU6LhAfLTgeYuD_no
ADMIN_EMAIL=your-email@gmail.com
```

### Production (Google Cloud Run):

Set these in Cloud Run Environment Variables:
```
Console: Cloud Run → gyanology → Edit & Deploy New Revision → Runtime Settings
Or via gcloud:
gcloud run deploy gyanology \
  --update-env-vars ADMIN_EMAIL=your-email@gmail.com
```

## 📧 Email Flow Diagram

```
User submits form
    ↓
POST /api/contact
    ↓
Save to contacts.json
    ↓
Call handleContactEmail()
    ↓
├─ Send Admin Notification
│  └─ To: ADMIN_EMAIL (from .env)
│
└─ Send Auto-Reply
   └─ To: User's email (from form)
    ↓
Response: "Message received. Check your email for confirmation."
```

## ⚠️ Troubleshooting

**Emails not sending?**
- ✅ Check `.env` file has correct admin email
- ✅ Check @emailjs/nodejs installed: `npm ls @emailjs/nodejs`
- ✅ Check EmailJS dashboard for email delivery logs
- ✅ Check terminal for error messages

**Templates not found?**
- ✅ Verify template IDs in `.env` match your EmailJS account
- ✅ Check templates are published (not draft)

**Spam folder?**
- ✅ Add custom domain email in EmailJS for better delivery
- ✅ Check EmailJS template for unsubscribe link requirement

## 📞 Admin Contact Form Response

When admin replies via EmailJS, you can add:
- ✅ Custom email signature
- ✅ Attachment support
- ✅ HTML formatting
- ✅ Auto-forward to team members

## 🎉 Done!

Your Gyanology site now has:
- ✅ Working contact form
- ✅ Email notifications to admin
- ✅ Automatic user responses
- ✅ Bilingual support (template variables can use Hindi)
- ✅ Production-ready email setup

---

**Test it now**: Submit the contact form and check your email! 📬
