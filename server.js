const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function makeAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

// Test connection + fetch all categories (each category = one manga)
app.post('/api/fetch-categories', async (req, res) => {
  const { wpUrl, wpUser, wpPass } = req.body;

  if (!wpUrl || !wpUser || !wpPass) {
    return res.status(400).json({ error: 'Missing wpUrl, wpUser or wpPass' });
  }

  const auth = makeAuth(wpUser, wpPass);
  let allCategories = [];
  let page = 1;
  let totalPages = 1;

  console.log(`[fetch-categories] Connecting to: ${wpUrl}`);

  try {
    // First test: check REST API is reachable
    const testRes = await fetch(`${wpUrl}/wp-json/wp/v2/`, {
      headers: { Authorization: auth }
    });
    if (!testRes.ok) {
      const txt = await testRes.text();
      console.error(`[fetch-categories] REST API test failed: ${testRes.status} - ${txt.slice(0, 200)}`);
      return res.status(testRes.status).json({ error: `WordPress REST API returned ${testRes.status}. Check your site URL.` });
    }
    console.log(`[fetch-categories] REST API reachable ✓`);

    // Fetch all categories paginated
    while (page <= totalPages) {
      const url = `${wpUrl}/wp-json/wp/v2/categories?per_page=100&page=${page}&_fields=id,name,description,slug,count,link`;
      console.log(`[fetch-categories] Fetching page ${page}/${totalPages}: ${url}`);

      const response = await fetch(url, { headers: { Authorization: auth } });

      if (!response.ok) {
        const text = await response.text();
        console.error(`[fetch-categories] Error on page ${page}: ${response.status} - ${text.slice(0, 300)}`);
        return res.status(response.status).json({ error: `WordPress error ${response.status}: ${text.slice(0, 200)}` });
      }

      totalPages = parseInt(response.headers.get('X-WP-TotalPages') || '1');
      const data = await response.json();
      allCategories = [...allCategories, ...data];
      console.log(`[fetch-categories] Page ${page}: got ${data.length} categories`);
      page++;
    }

    // Filter out the default "Uncategorized" category
    const filtered = allCategories.filter(c => c.slug !== 'uncategorized' && c.count > 0);
    console.log(`[fetch-categories] Total: ${filtered.length} manga categories`);
    res.json({ categories: filtered, total: filtered.length });

  } catch (err) {
    console.error(`[fetch-categories] Exception: ${err.message}`);
    res.status(500).json({ error: `Connection failed: ${err.message}. Make sure your WordPress URL is correct and the server is reachable.` });
  }
});

// Update a category description
app.post('/api/update-category', async (req, res) => {
  const { wpUrl, wpUser, wpPass, categoryId, description } = req.body;
  const auth = makeAuth(wpUser, wpPass);

  console.log(`[update-category] Updating category #${categoryId} on ${wpUrl}`);

  try {
    const response = await fetch(`${wpUrl}/wp-json/wp/v2/categories/${categoryId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth
      },
      body: JSON.stringify({ description })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[update-category] Error: ${response.status} - ${text.slice(0, 300)}`);
      return res.status(response.status).json({ error: `WordPress error ${response.status}: ${text.slice(0, 200)}` });
    }

    const data = await response.json();
    console.log(`[update-category] Category #${categoryId} updated ✓`);
    res.json({ success: true, id: data.id, slug: data.slug });

  } catch (err) {
    console.error(`[update-category] Exception: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Parse uploaded CSV
app.post('/api/parse-csv', upload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const text = req.file.buffer.toString('utf-8');
  const lines = text.split('\n');
  const result = {};

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    // Handle quoted CSV fields
    const match = trimmed.match(/^"?([^",]+)"?,(.+)$/);
    if (match) {
      const title = match[1].trim().toLowerCase();
      const url = match[2].trim().replace(/^"|"$/g, '');
      if (title && url) result[title] = url;
    }
  });

  console.log(`[parse-csv] Parsed ${Object.keys(result).length} entries`);
  res.json({ csvData: result, count: Object.keys(result).length });
});

app.listen(PORT, () => {
  console.log(`\n✅  Manga Affiliate Manager running at http://localhost:${PORT}`);
  console.log(`    Open: http://localhost:3000\n`);
});
