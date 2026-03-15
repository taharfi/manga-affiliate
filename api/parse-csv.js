module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const text = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const result = {};
  text.split('\n').forEach(line => {
    const m = line.trim().match(/^"?([^",]+)"?,(.+)$/);
    if (m) { const t = m[1].trim().toLowerCase(); const u = m[2].trim().replace(/^"|"$/g,''); if (t && u) result[t] = u; }
  });
  return res.json({ csvData: result, count: Object.keys(result).length });
};