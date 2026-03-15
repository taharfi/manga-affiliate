# 📚 Manga Affiliate Manager

A local web tool to add Amazon affiliate "Support the creator" sections to your WordPress manga posts — with a review-before-publish workflow.

---

## Requirements

- [Node.js](https://nodejs.org/) v16 or higher
- WordPress site with REST API enabled (default in WP 5.0+)
- WordPress Application Password (WP 5.6+)

---

## Setup

### 1. Install dependencies

```bash
cd manga-affiliate
npm install
```

### 2. Start the server

```bash
npm start
```

### 3. Open your browser

Go to: **http://localhost:3000**

---

## How to use

### Step 1 — Connect WordPress
- Enter your WordPress site URL (e.g. `https://yoursite.com`)
- Enter your **username**
- Generate an **Application Password**:
  - Go to WordPress Dashboard → Users → Your Profile
  - Scroll to "Application Passwords"
  - Enter a name (e.g. "Affiliate Manager") and click "Add New"
  - Copy the generated password
- Optionally enter your manga **category slug** to filter only manga posts
- Click **Fetch posts**

### Step 2 — Upload CSV & Review
Prepare a CSV file with two columns — no header row needed:

```
One Piece Vol. 1,https://amzn.to/yourcode
Naruto Vol. 1,https://amzn.to/yourcode2
Attack on Titan Vol. 1,https://amzn.to/yourcode3
```

- Upload the CSV and click **Match posts**
- The tool fuzzy-matches titles automatically
- Review each matched post — see a preview of the section to be added
- For unmatched posts, paste the Amazon URL manually
- Click **Approve ✓** on each post you want to update
- When done, click **Publish approved →**

### Step 3 — Publish
- Review the summary and click **Run publish**
- The tool appends the affiliate section to each approved post via the WordPress REST API
- A live log shows success/failure for each post
- Posts that already have an affiliate section are automatically skipped (no duplicates)

---

## The affiliate section added to each post

```html
📚 Support the creator
Love reading [Manga Title]? Support the author by buying the official physical edition!
[🛒 Buy on Amazon] button
As an Amazon Associate I earn from qualifying purchases.
```

---

## CSV format tips

- No header row needed
- Titles are fuzzy-matched (case-insensitive, partial match supported)
- If a title has commas, wrap it in quotes: `"My Hero Academia, Vol. 1",https://amzn.to/xxx`
- You can add URLs manually inside the tool for unmatched posts

---

## Security notes

- Your WordPress credentials are only used locally — they never leave your machine (the server proxies requests from localhost to your WordPress site)
- Application Passwords can be revoked at any time from your WordPress dashboard
- The server runs only on `localhost:3000` — it is not exposed to the internet

---

## Stopping the server

Press `Ctrl+C` in the terminal.
