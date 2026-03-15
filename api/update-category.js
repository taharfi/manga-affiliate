const fetch = require('node-fetch');
function makeAuth(u, p) { return 'Basic ' + Buffer.from(`${u}:${p}`).toString('base64'); }
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { wpUrl, wpUser, wpPass, categoryId, description } = req.body;
  if (!wpUrl || !wpUser || !wpPass || !categoryId) return res.status(400).json({ error: 'Missing fields' });
  try {
    const r = await fetch(`${wpUrl}/wp-json/wp/v2/categories/${categoryId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: makeAuth(wpUser, wpPass) },
      body: JSON.stringify({ description })
    });
    if (!r.ok) { const t = await r.text(); return res.status(r.status).json({ error: `WP error ${r.status}: ${t.slice(0,200)}` }); }
    const d = await r.json();
    return res.json({ success: true, id: d.id });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};