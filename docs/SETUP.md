# Setup Guide — API Keys

## ✅ Already Done
- **OpenRouter API** — Configured in .env (for AI content generation)

---

## 🔵 Facebook Page Publishing (Engine 5)

### Step 1: Create Facebook App
1. Go to https://developers.facebook.com/
2. Click **My Apps** → **Create App**
3. Select **Business** type → Give it a name (e.g., "FixMyLeads Bot")
4. Click **Create App**

### Step 2: Get User Access Token
1. Go to https://developers.facebook.com/tools/explorer/
2. Select your app from the dropdown
3. Click **Generate Access Token**
4. Add these permissions:
   - `pages_manage_posts` (post to page)
   - `pages_show_list` (see your pages)
   - `pages_read_engagement` (read insights)
5. Click **Generate Access Token** and approve

### Step 3: Get Page ID
1. Go to https://www.facebook.com/ (your page)
2. Click **About** → **Page transparency** → Copy **Page ID**
3. Or use Graph API: `GET /me/accounts` with your user token

### Step 4: Exchange for Page Token
1. Go to Graph API Explorer: https://developers.facebook.com/tools/explorer/
2. Use this query:
   ```
   GET /me/accounts?fields=id,name,access_token
   ```
3. Find your page in the response → Copy the `access_token` value
4. This is your **FB_PAGE_ACCESS_TOKEN**

### Step 5: Update .env
```
FB_PAGE_ACCESS_TOKEN=your_page_token_here
FB_PAGE_ID=your_page_id_here
```

### Step 6: Switch to Live Mode
```
PROVIDER_MODE=live
```

---

## 🟢 Google Sheets API (Write-back Status)

### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Click **Select a project** → **New Project**
3. Name it (e.g., "FixMyLeads Sheets") → Click **Create**

### Step 2: Enable Sheets API
1. Go to https://console.cloud.google.com/apis/library/sheets.googleapis.com
2. Click **Enable**

### Step 3: Create API Key
1. Go to https://console.cloud.google.com/apis/credentials
2. Click **Create Credentials** → **API Key**
3. Copy the key

### Step 4: Share Your Sheet
1. Open your Google Sheet
2. Click **Share** → **General Access** → **Anyone with the link**
3. This allows the API key to read/write

### Step 5: Update .env
```
GOOGLE_SHEETS_API_KEY=your_api_key_here
```

---

## 📱 Instagram Publishing (Future)

Instagram requires Facebook Business account:
1. Connect Instagram to your Facebook Page
2. Use same Facebook token with `instagram_basic`, `instagram_content_publish` permissions
3. Post via: `POST /{ig-user-id}/media` → `POST /{ig-user-id}/media_publish`

---

## Quick Test Commands

### Test Facebook Publishing
```bash
cd /home/ubuntu/ai-team
node -e "
const ecm = require('./core/ecm-bridge.cjs');
ecm.runPublish({ content: { captions: ['Test post from FixMyLeads!'] }, script: 'Test' })
  .then(r => console.log(JSON.stringify(r, null, 2)));
"
```

### Test Google Sheets
```bash
cd /home/ubuntu/ai-team
node -e "
const sheets = require('./departments/lead-intel/sheets-api.cjs');
sheets.updateStatus(process.env.AUTOPILOT_SHEET_URL, { email: 'test@example.com', status: 'Sent 1' })
  .then(r => console.log(r));
"
```

### Test Content Generation
```bash
cd /home/ubuntu/ai-team
node -e "
const ecm = require('./core/ecm-bridge.cjs');
ecm.generateSocialContent({ businessName: 'FixMyLeads', niche: 'Digital Marketing' })
  .then(r => console.log(JSON.stringify(r.data?.content?.captions, null, 2)));
"
```
