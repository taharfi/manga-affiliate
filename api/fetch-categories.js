const fetch = require('node-fetch');
function makeAuth(u, p) { return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64'); }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { wpUrl, wpUser, wpPass } = req.body;
  if (!wpUrl || !wpUser || !wpPass) return res.status(400).json({ error: 'Missing fields' });
  const auth = makeAuth(wpUser, wpPass);
  let all = [], page = 1, total = 1;
  try {
    const test = await fetch(`${wpUrl}/wp-json/wp/v2/`, { headers: { Authorization: auth } });
    if (!test.ok) return res.status(test.status).json({ error: `WordPress returned ${test.status}. Check your URL and credentials.` });
    while (page <= total) {
      const r = await fetch(`${wpUrl}/wp-json/wp/v2/categories?per_page=100&page=${page}&_fields=id,name,description,slug,count,link`, { headers: { Authorization: auth } });
      if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: `WP error ${r.status}: ${t.slice(0,200)}` }); }
      total = parseInt(r.headers.get('X-WP-TotalPages') || '1');
      all = [...all, ...await r.json()];
      page++;
    }
    const filtered = all.filter(c => c.slug !== 'uncategorized' && c.count > 0);
    return res.json({ categories: filtered, total: filtered.length });
  } catch(e) { return res.status(500).json({ error: 'Connection failed: ' + e.message }); }
};