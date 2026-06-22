# 🚀 Complete Deployment Guide - Gyanology to Google Cloud

## ✅ Pre-Deployment Status

All fixes have been applied and tested locally:

- ✅ Backend server running on port 3000
- ✅ Smart API resolution in frontend (tries localhost:3000, localhost:8080, or production origin)
- ✅ All 20+ articles loading successfully
- ✅ Article details, metadata, and language switching working
- ✅ Contact, Newsletter, and Admin features ready
- ✅ Sitemap.xml and robots.txt configured

## 📋 Step 1: Install Google Cloud SDK

### For Windows (PowerShell):

```powershell
# Download and install Google Cloud SDK
winget install Google.Cloud.SDK --accept-source-agreements -e

# Restart PowerShell after installation
```

### Alternative (Manual Download):
Visit: https://cloud.google.com/sdk/docs/install and download the Windows installer

## 🔐 Step 2: Authenticate with Google Cloud

```powershell
# Open PowerShell and run:
gcloud auth login

# A browser window will open - sign in with your Google account
# Select or create a Google Cloud project
```

## 🌍 Step 3: Set Up Your Project

```powershell
cd "c:\Users\lenovo\OneDrive\Desktop\google website"

# Set your Google Cloud project ID
# Replace YOUR_PROJECT_ID with your actual project ID from Google Cloud Console
gcloud config set project YOUR_PROJECT_ID

# Verify configuration
gcloud config list
```

## 📦 Step 4: Deploy to Google Cloud Run

```powershell
# From the project root directory, run:
gcloud run deploy gyanology `
  --source . `
  --region asia-south1 `
  --allow-unauthenticated `
  --memory 512Mi `
  --cpu 1

# Or for other regions:
# asia-south1 (Mumbai - recommended for India)
# us-central1 (USA)
# europe-west1 (Europe)
```

**The deployment will:**
- Build a Docker container automatically
- Deploy your Node.js backend + frontend
- Provide a temporary Cloud Run URL (like: https://gyanology-xxxxx.run.app)

## ✅ Step 5: Test Live Deployment

After deployment completes, test these URLs:

```
https://gyanology-xxxxx.run.app/                          # Home page
https://gyanology-xxxxx.run.app/articles.html             # Articles page
https://gyanology-xxxxx.run.app/api/articles              # API endpoint
https://gyanology-xxxxx.run.app/api/health                # Health check
https://gyanology-xxxxx.run.app/sitemap.xml               # Sitemap
https://gyanology-xxxxx.run.app/robots.txt                # Robots file
```

## 🌐 Step 6: Set Up Custom Domain

1. Buy a domain (GoDaddy, Namecheap, Google Domains, etc.)
2. In Google Cloud Console:
   - Go to Cloud Run → gyanology service
   - Click "Manage Custom Domains"
   - Add your domain
   - Follow DNS verification steps
3. Update DNS records at your domain registrar with the provided CNAME

## 📊 Step 7: Prepare for AdSense Approval

### Before submitting to AdSense:

1. **Domain Requirements:**
   - ✅ Custom domain active and verified
   - ✅ HTTPS working (Cloud Run provides free HTTPS)
   - ✅ 20+ quality original articles (You have 20+ ready!)

2. **Content Requirements:**
   - ✅ Home page with clear topic/purpose
   - ✅ About page explaining the site
   - ✅ Contact page for users
   - ✅ Privacy Policy (already added)
   - ✅ Terms & Conditions (already added)

3. **Metadata:**
   - Update `frontend/privacy-policy.html` with your email
   - Replace `YOUR_GOOGLE_VERIFICATION_CODE` in HTML files
   - Update `frontend/ads.txt` with your AdSense publisher ID

4. **Submit to AdSense:**
   ```
   https://your-domain.com
   ```

## 🔄 Step 8: Continuous Deployment

After initial deployment, to redeploy with changes:

```powershell
gcloud run deploy gyanology --source .
```

## 📚 Useful Commands

```powershell
# View deployment logs
gcloud run logs read gyanology --limit 100

# Get service details
gcloud run services describe gyanology

# Check traffic and requests
gcloud monitoring metrics-descriptors list --filter="resource.type=cloud_run_revision"

# View deployment history
gcloud run revisions list
```

## 💡 Environment Variables in Production

The app automatically:
- Uses the PORT environment variable set by Cloud Run
- Defaults to port 8080 if PORT isn't set
- Frontend auto-resolves API from `window.location.origin`

## 🛡️ Security Checklist

- ✅ CORS headers configured
- ✅ No sensitive data in frontend
- ✅ Node.js dependencies minimal (no vulnerabilities)
- ✅ File upload validation in place
- ✅ Input sanitization on contact form

## 📞 Support & Troubleshooting

### Deployment fails:
- Check if `app.yaml` is correct
- Verify `package.json` exists in root
- Ensure Node.js version is specified

### Articles not loading on live:
- Check Cloud Run logs: `gcloud run logs read gyanology`
- Verify `/api/articles` endpoint responds: `https://your-domain.com/api/articles`
- Check browser console for CORS issues

### Domain issues:
- Wait 24-48 hours for DNS propagation
- Verify DNS records at: https://mxtoolbox.com/
- Check Cloud Run service has domain mapped

## 🎉 Congratulations!

Your Gyanology educational platform is ready for:
- ✅ Global visitors
- ✅ SEO indexing
- ✅ Google AdSense approval
- ✅ Mobile-responsive content
- ✅ Bilingual (English/Hindi) support

---

**Questions?** Check Google Cloud documentation: https://cloud.google.com/run/docs

**Ready to deploy?** Start with Step 1 and follow each step in order. You've got this! 🚀
