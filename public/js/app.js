'use strict';

// ── State ────────────────────────────────────────────────────────────────────
let wpConfig   = {};
let allCats    = [];
let csvData    = {};
let matched    = [];
let decisions  = {};
let currentTab = 'pending';

// ── Affiliate HTML template ──────────────────────────────────────────────────
function affiliateSection(title, url) {
  return '\n\n<!-- manga-affiliate-section -->\n' +
    '<div style="border-top:2px solid #e2e8f0;margin-top:24px;padding-top:18px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">\n' +
    '  <p style="font-size:15px;font-weight:700;margin:0 0 8px;">&#128218; Support the creator</p>\n' +
    '  <p style="font-size:13px;color:#555;margin:0 0 12px;">Love reading <strong>' + escHtml(title) + '</strong>? Support the author by buying the official physical edition!</p>\n' +
    '  <a href="' + escHtml(url) + '" target="_blank" rel="nofollow sponsored noopener"\n' +
    '     style="display:inline-block;background:#ff9900;color:#000;text-decoration:none;padding:10px 22px;border-radius:6px;font-size:13px;font-weight:700;">\n' +
    '    &#128722; Buy on Amazon\n' +
    '  </a>\n' +
    '  <p style="font-size:11px;color:#aaa;margin:10px 0 0;">As an Amazon Associate I earn from qualifying purchases.</p>\n' +
    '</div>\n' +
    '<!-- /manga-affiliate-section -->';
}

// ── Steps ────────────────────────────────────────────────────────────────────
function goStep(n) {
  document.querySelectorAll('.step').forEach(function(s, i) { s.classList.toggle('active', i === n - 1); });
  renderDots(n);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderDots(active) {
  var d = document.getElementById('dots');
  d.innerHTML = [1, 2, 3].map(function(i) {
    return '<div class="step-dot ' + (i < active ? 'done' : i === active ? 'active' : '') + '"></div>' +
           (i < 3 ? '<div class="step-line"></div>' : '');
  }).join('');
}
renderDots(1);

function showError(msg) {
  var box = document.getElementById('error-box');
  box.textContent = msg;
  box.style.display = 'block';
}
function clearError() {
  var box = document.getElementById('error-box');
  box.style.display = 'none';
  box.textContent = '';
}

// ── Step 1: Fetch categories ──────────────────────────────────────────────────
async function fetchCategories() {
  clearError();
  var url  = document.getElementById('wp-url').value.trim().replace(/\/$/, '');
  var user = document.getElementById('wp-user').value.trim();
  var pass = document.getElementById('wp-pass').value.trim();

  if (!url)  { showError('Please enter your WordPress site URL.'); return; }
  if (!user) { showError('Please enter your WordPress username.'); return; }
  if (!pass) { showError('Please enter your Application Password.'); return; }
  if (!url.startsWith('http')) { showError('URL must start with http:// or https://'); return; }

  wpConfig = { wpUrl: url, wpUser: user, wpPass: pass };

  var btn = document.getElementById('fetch-btn');
  btn.textContent = 'Connecting…';
  btn.disabled = true;

  try {
    var res = await fetch('/api/fetch-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wpConfig)
    });
    var data = await res.json();

    if (!res.ok) {
      showError('Error: ' + (data.error || ('HTTP ' + res.status)));
      return;
    }
    if (!data.categories || data.categories.length === 0) {
      showError('No categories found. Make sure your credentials are correct and your site has categories with posts.');
      return;
    }

    allCats = data.categories;
    buildMatches();
    goStep(2);
    renderStats();
    renderList();
  } catch (e) {
    showError('Could not reach the local server. Make sure "npm start" is running. Detail: ' + e.message);
  } finally {
    btn.textContent = 'Fetch manga categories →';
    btn.disabled = false;
  }
}

// ── Demo ─────────────────────────────────────────────────────────────────────
function loadDemo() {
  clearError();
  wpConfig = { wpUrl: 'http://demo', wpUser: 'admin', wpPass: 'demo' };
  allCats = [
    { id:1, name:'One Piece',        slug:'one-piece',        description:'', count:1100, link:'https://demo.site/category/one-piece/' },
    { id:2, name:'Naruto',           slug:'naruto',           description:'', count:700,  link:'https://demo.site/category/naruto/' },
    { id:3, name:'Attack on Titan',  slug:'attack-on-titan',  description:'', count:139,  link:'https://demo.site/category/attack-on-titan/' },
    { id:4, name:'Demon Slayer',     slug:'demon-slayer',     description:'', count:205,  link:'https://demo.site/category/demon-slayer/' },
    { id:5, name:'Dragon Ball',      slug:'dragon-ball',      description:'', count:519,  link:'https://demo.site/category/dragon-ball/' },
    { id:6, name:'My Hero Academia', slug:'my-hero-academia', description:'', count:430,  link:'https://demo.site/category/my-hero-academia/' },
  ];
  csvData = {
    'one piece':       'https://amzn.to/onepiece',
    'naruto':          'https://amzn.to/naruto',
    'attack on titan': 'https://amzn.to/aot',
    'demon slayer':    'https://amzn.to/demonslayer',
  };
  buildMatches();
  goStep(2);
  renderStats();
  renderList();
}

// ── CSV ───────────────────────────────────────────────────────────────────────
async function uploadCSV() {
  var file = document.getElementById('csv-file').files[0];
  if (!file) return;
  var text = await file.text();
  try {
    var res = await fetch('/api/parse-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: text
    });
    var data = await res.json();
    if (!res.ok) { alert('CSV error: ' + data.error); return; }
    csvData = data.csvData;
    buildMatches();
    renderStats();
    renderList();
  } catch(e) { alert('Failed to parse CSV: ' + e.message); }
}


// ── Matching ──────────────────────────────────────────────────────────────────
function normalize(s) {
  return s.toLowerCase().replace(/<[^>]+>/g,'').replace(/[^a-z0-9\s]/g,'').trim();
}

function buildMatches() {
  matched = []; decisions = {};
  allCats.forEach(function(cat) {
    var normName = normalize(cat.name);
    var url = null;
    Object.keys(csvData).forEach(function(k) {
      var nk = normalize(k);
      if (nk === normName || normName.includes(nk) || nk.includes(normName)) url = csvData[k];
    });
    var alreadyHas = !!(cat.description && cat.description.includes('manga-affiliate-section'));
    matched.push({ cat: cat, url: url, title: cat.name, alreadyHas: alreadyHas });
    decisions[cat.id] = alreadyHas ? 'approved' : (url ? 'pending' : 'unmatched');
  });
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  var counts = { pending:0, approved:0, skipped:0, unmatched:0 };
  matched.forEach(function(m) { counts[decisions[m.cat.id]]++; });

  document.getElementById('stat-grid').innerHTML =
    '<div class="stat"><div class="stat-label">Total</div><div class="stat-val">' + matched.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Pending</div><div class="stat-val">' + counts.pending + '</div></div>' +
    '<div class="stat"><div class="stat-label">Approved</div><div class="stat-val green">' + counts.approved + '</div></div>' +
    '<div class="stat"><div class="stat-label">No match</div><div class="stat-val muted">' + counts.unmatched + '</div></div>';

  var actionable = matched.filter(function(m){ return decisions[m.cat.id] !== 'unmatched'; }).length || 1;
  var done       = matched.filter(function(m){ return decisions[m.cat.id] === 'approved' || decisions[m.cat.id] === 'skipped'; }).length;
  document.getElementById('prog').style.width = Math.round(done / actionable * 100) + '%';

  ['pending','approved','skipped','unmatched'].forEach(function(t) {
    var el = document.getElementById('t-' + t);
    if (el) el.textContent = '(' + counts[t] + ')';
  });

  var pb = document.getElementById('publish-btn');
  if (pb) pb.disabled = counts.approved === 0;
}

// ── List ──────────────────────────────────────────────────────────────────────
function switchTab(el) {
  currentTab = el.dataset.tab;
  document.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  el.classList.add('active');
  renderList();
}

function renderList() {
  var container = document.getElementById('manga-list');
  var items = matched.filter(function(m){ return decisions[m.cat.id] === currentTab; });

  if (!items.length) {
    container.innerHTML = '<div class="empty">No items in this list.</div>';
    return;
  }

  container.innerHTML = items.map(function(item) {
    var cat = item.cat, url = item.url, title = item.title, alreadyHas = item.alreadyHas;
    var id = cat.id;
    var status = decisions[id];
    var badgeMap = { pending:'badge-pending', approved:'badge-approved', skipped:'badge-skipped', unmatched:'badge-unmatched' };

    var currentDesc = cat.description
      ? cat.description.replace(/<[^>]+>/g,'').trim().slice(0,200) + '…'
      : '(no description yet)';

    var previewBlock = url
      ? '<div class="desc-label">Section to be added</div>' +
        '<div class="preview-box">' +
        '<div class="preview-label">Preview</div>' +
        '<div style="border-top:2px solid #bfdbfe;margin-top:6px;padding-top:10px;">' +
        '<strong style="font-size:13px;">📚 Support the creator</strong>' +
        '<p style="font-size:12px;color:#555;margin:5px 0 8px;">Love reading <strong>' + escHtml(title) + '</strong>? Get the official physical edition!</p>' +
        '<a href="' + escHtml(url) + '" style="display:inline-block;background:#ff9900;color:#000;text-decoration:none;padding:6px 14px;border-radius:5px;font-size:12px;font-weight:700;" target="_blank">🛒 Buy on Amazon</a>' +
        '<p style="font-size:11px;color:#aaa;margin:6px 0 0;">As an Amazon Associate I earn from qualifying purchases.</p>' +
        '</div></div>'
      : '<div class="desc-label">No CSV match — paste Amazon URL manually</div>' +
        '<div class="manual-url-row"><input type="url" id="url-' + id + '" placeholder="https://amzn.to/..." /></div>';

    var alreadyNote = alreadyHas ? '<span class="badge badge-exists" style="margin-left:6px;">already has section</span>' : '';

    var actionsMap = {
      pending:   '<button class="btn success" onclick="decide(' + id + ',\'approved\')">Approve ✓</button>' +
                 '<button class="btn" onclick="decide(' + id + ',\'skipped\')">Skip</button>',
      approved:  alreadyHas
                   ? '<span style="font-size:12px;color:#888;">Already updated — no action needed.</span>'
                   : '<button class="btn danger" onclick="decide(' + id + ',\'pending\')">Undo</button>',
      skipped:   '<button class="btn" onclick="decide(' + id + ',\'pending\')">Restore</button>',
      unmatched: '<button class="btn success" onclick="approveManual(' + id + ')">Add & Approve</button>'
    };

    return '<div class="manga-card" id="mc-' + id + '">' +
      '<div class="manga-card-header">' +
        '<span class="manga-title">' + escHtml(title) + alreadyNote + '</span>' +
        '<span class="badge ' + badgeMap[status] + '">' + status + '</span>' +
      '</div>' +
      '<a class="manga-link" href="' + (cat.link||'#') + '" target="_blank">' + escHtml(cat.link||'') + '</a>' +
      '<div style="font-size:12px;color:#aaa;margin-bottom:8px;">' + cat.count + ' chapter' + (cat.count!==1?'s':'') + '</div>' +
      '<div class="desc-label">Current description</div>' +
      '<div class="desc-box">' + escHtml(currentDesc) + '</div>' +
      previewBlock +
      '<div class="btn-row" style="margin-top:10px;">' + actionsMap[status] + '</div>' +
      '</div>';
  }).join('');
}

function decide(id, status) {
  decisions[id] = status;
  renderStats();
  renderList();
}

function approveManual(id) {
  var input = document.getElementById('url-' + id);
  var val   = input ? input.value.trim() : '';
  if (!val) { alert('Please paste an Amazon affiliate URL first.'); return; }
  var m = matched.find(function(x){ return x.cat.id === id; });
  if (m) m.url = val;
  decisions[id] = 'approved';
  renderStats();
  renderList();
}

// ── Publish ───────────────────────────────────────────────────────────────────
function goToPublish() {
  var approved  = matched.filter(function(m){ return decisions[m.cat.id]==='approved'; }).length;
  var skipped   = matched.filter(function(m){ return decisions[m.cat.id]==='skipped'; }).length;
  var unmatched = matched.filter(function(m){ return decisions[m.cat.id]==='unmatched'; }).length;

  document.getElementById('pub-stat-grid').innerHTML =
    '<div class="stat"><div class="stat-label">To publish</div><div class="stat-val green">' + approved + '</div></div>' +
    '<div class="stat"><div class="stat-label">Skipped</div><div class="stat-val muted">' + skipped + '</div></div>' +
    '<div class="stat"><div class="stat-label">Unmatched</div><div class="stat-val muted">' + unmatched + '</div></div>' +
    '<div class="stat"><div class="stat-label">Total</div><div class="stat-val">' + matched.length + '</div></div>';
  goStep(3);
}

function plog(msg, type) {
  type = type || 'info';
  var box  = document.getElementById('pub-log');
  var line = document.createElement('div');
  line.className = 'log-' + type;
  line.textContent = (type==='ok' ? '✓  ' : type==='err' ? '✗  ' : '   ') + msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

async function runPublish() {
  var btn = document.getElementById('run-btn');
  btn.disabled = true; btn.textContent = 'Publishing…';
  document.getElementById('pub-log').innerHTML = '';

  var toPublish  = matched.filter(function(m){ return decisions[m.cat.id]==='approved' && !m.alreadyHas; });
  var alreadyDone = matched.filter(function(m){ return decisions[m.cat.id]==='approved' && m.alreadyHas; });

  plog('Starting — ' + toPublish.length + ' categor' + (toPublish.length!==1?'ies':'y') + ' to update', 'info');
  if (alreadyDone.length) plog(alreadyDone.length + ' already updated — skipping', 'info');

  var ok = 0, fail = 0;

  for (var i = 0; i < toPublish.length; i++) {
    var m    = toPublish[i];
    var cat  = m.cat;
    var url  = m.url;
    var title = m.title;
    var newDesc = (cat.description || '') + affiliateSection(title, url);

    if (wpConfig.wpUrl === 'http://demo') {
      await new Promise(function(r){ setTimeout(r, 450); });
      plog('[DEMO] "' + title + '" — would update category #' + cat.id, 'ok');
      ok++; continue;
    }

    try {
      var res = await fetch('/api/update-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wpUrl:       wpConfig.wpUrl,
          wpUser:      wpConfig.wpUser,
          wpPass:      wpConfig.wpPass,
          categoryId:  cat.id,
          description: newDesc
        })
      });
      var data = await res.json();
      if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
      plog('"' + title + '" — updated ✓', 'ok');
      m.alreadyHas = true;
      ok++;
    } catch(e) {
      plog('"' + title + '" — FAILED: ' + e.message, 'err');
      fail++;
    }
  }

  plog('Done! ' + ok + ' updated' + (fail ? ', ' + fail + ' failed' : '') + '.', 'info');
  btn.textContent = 'Run again'; btn.disabled = false;
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
