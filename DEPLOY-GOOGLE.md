# Gyanology Google Hosting Checklist

Use Google Cloud Run for the simplest frontend + backend deployment.

## 1. Local check

```powershell
npm install
npm start
```

Open:

```text
http://localhost:3000
```

## 2. Deploy to Google Cloud Run

Install and sign in to Google Cloud CLI, then run these commands from this project folder:

```powershell
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud run deploy gyanology --source . --region asia-south1 --allow-unauthenticated
```

After deploy, open the Cloud Run URL and test:

```text
/api/health
/articles.html
/contact.html
/privacy-policy.html
/sitemap.xml
/robots.txt
```

## 3. Custom domain

In Google Cloud Run, map your custom domain to the service. After DNS is verified, submit the custom domain in Google AdSense, not the temporary Cloud Run URL.

## 4. AdSense approval checklist

- Keep at least 20-30 useful original articles live before applying.
- Make sure Home, Articles, About, Contact, Privacy Policy, Terms, and Disclaimer all open without errors.
- Replace placeholder contact email with your real domain email (for example `contact@yourdomain.com`).
- Add a `google-site-verification` meta tag to the head of your main pages after you verify your domain.
- Add your AdSense publisher line to `frontend/ads.txt` after Google gives you the publisher ID.
- Do not add empty ad boxes or misleading ad labels before approval.
- Submit `https://your-domain.com/sitemap.xml` in Google Search Console.
- Use only original or properly licensed images/content.

## 5. After approval

Add the AdSense script in the `<head>` of all public pages using the code provided inside your AdSense account.
