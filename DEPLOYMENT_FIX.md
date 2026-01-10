# 🚨 Cloud Run Deployment Fix for DecXpert CT

## Issue Identified
Your deployed app at decxpert-ct.com is failing due to **Cloud Run timeout and request size limits**.

### Problems:
1. **Default Cloud Run timeout**: 5 minutes (too short for 200-slice CT analysis)
2. **HTTP/1.1 request size limit**: 32 MB (CT scans can exceed this)
3. **Insufficient memory**: Default 512 MB (medical imaging needs more)

---

## ✅ Fix Instructions

### Step 1: Configure Deployment Settings in Replit

1. **Go to your Replit deployment settings**:
   - Open your Repl
   - Click on "Deployments" tab
   - Click on your active deployment

2. **Update Machine Configuration**:
   - Set **Memory**: `2 GiB` or higher
   - Set **CPU**: `2` cores minimum
   - Set **Max Instances**: `10`

3. **Add Environment Variables** (if not already set):
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `DATABASE_URL`: Your Neon database URL
   - `NODE_ENV`: `production`

### Step 2: Redeploy Your Application

After updating the settings:
1. Click "Redeploy" button
2. Wait for deployment to complete
3. Test at decxpert-ct.com

---

## Alternative: Manual Cloud Run Configuration

If you have access to Google Cloud Console:

```bash
# Update your Cloud Run service with proper settings
gcloud run services update decxpert-ct \
  --timeout=900 \
  --memory=2Gi \
  --cpu=2 \
  --max-instances=10 \
  --min-instances=0
```

---

## Verification Steps

After redeployment, verify:

1. **Health Check**: Visit `https://decxpert-ct.com/health`
   - Should return: `{"status":"healthy","timestamp":"..."}`

2. **API Health**: Visit `https://decxpert-ct.com/api/v1/health`
   - Should return: `{"status":"healthy","service":"DecXpert CT Analysis API",...}`

3. **Upload Test**: Upload a CT scan (start with <50 slices to test)

---

## Additional Recommendations

### For Large CT Scans (150-200 slices):

1. **Enable HTTP/2** (if available in Replit settings):
   - Removes 32 MB request limit
   - Allows unlimited request size

2. **Client-side slice selection** (already implemented):
   - System automatically selects 200 representative slices
   - Reduces upload size while maintaining accuracy

3. **Chunked upload** (already implemented):
   - Uploads in batches of 20 files
   - 6 concurrent uploads for speed
   - Compression enabled (gzip/deflate/brotli)

---

## Current Server Configuration ✅

Your server is already configured correctly:
- ✅ Server timeout: 10 minutes (600s)
- ✅ Keep-alive timeout: 10m 10s
- ✅ Headers timeout: 10m 20s
- ✅ Health check endpoint: `/health`
- ✅ Request payload limit: 100mb
- ✅ Compression enabled

**The issue is Cloud Run's default settings, not your code.**

---

## Contact Support

If issues persist after redeployment:
1. Check Replit deployment logs for errors
2. Verify OPENAI_API_KEY is set in production secrets
3. Contact Replit support for Cloud Run timeout configuration assistance

---

## Quick Test Command

After redeployment, test with:
```bash
curl https://decxpert-ct.com/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2025-10-11T..."}
```
