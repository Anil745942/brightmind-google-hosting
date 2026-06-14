# 📧 EmailJS Templates Setup Guide

## Step 1: Open EmailJS Dashboard
👉 https://dashboard.emailjs.com/admin/templates

---

## Step 2: Template 1 — Admin Notification

Click **"Create New Template"** and fill these fields:

| Field         | Value                                              |
|---------------|----------------------------------------------------|
| Template Name | `BrightMind Contact Notification`                  |
| To Email      | `ragamer3214@gmail.com`                            |
| From Name     | `{{from_name}}`                                    |
| Reply To      | `{{reply_to}}`                                     |
| Subject       | `🔔 New Contact: {{subject}} — from {{from_name}}` |

### Body:
Open `admin-notification-template.html` file, **Select All → Copy**, 
then paste into the **Content** box in EmailJS dashboard.

Click **Save** → Copy the **Template ID**

---

## Step 3: Template 2 — Auto Reply (User ko email)

Click **"Create New Template"** again and fill:

| Field         | Value                                                          |
|---------------|----------------------------------------------------------------|
| Template Name | `BrightMind Auto Reply`                                        |
| To Email      | `{{to_email}}`                                                 |
| From Name     | `BrightMind Team`                                              |
| Reply To      | `ragamer3214@gmail.com`                                        |
| Subject       | `✅ Thank you {{user_name}}! We received your message — BrightMind` |

### Body:
Open `auto-reply-template.html` file, **Select All → Copy**, 
then paste into the **Content** box in EmailJS dashboard.

Click **Save** → Copy the **Template ID**

---

## Step 4: Update Template IDs in Code

Open `frontend/js/emailjs-service.js` and update line 20-21:

```js
TEMPLATE_ID_CONTACT: 'paste_new_contact_template_id_here',
TEMPLATE_ID_REPLY: 'paste_new_reply_template_id_here'
```

Also update in `backend/.env`:

```
EMAILJS_TEMPLATE_CONTACT=paste_new_contact_template_id_here
EMAILJS_TEMPLATE_REPLY=paste_new_reply_template_id_here
```

---

## ✅ Test

1. Open http://localhost:3000/contact.html
2. Fill and submit the form
3. Check console (F12) for ✅ messages
4. Check user's email inbox for auto-reply
