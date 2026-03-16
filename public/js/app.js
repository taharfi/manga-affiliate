'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
var wpConfig   = {};
var allCats    = [];
var csvData    = {};
var matched    = [];
var decisions  = {};
var reinject   = {};   // { catId: true } — flagged for re-inject
var currentTab = 'pending';

// ── Affiliate HTML template ───────────────────────────────────────────────────
function affiliateSection(title, url) {
  return '\n\n<!-- manga-affiliate-section -->\n' +
    '<div style="margin-top:32px;padding:22px 24px;background:#1a1a2e;border-radius:12px;border:2px solid #7c3aed;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;text-align:center;">\n' +
    '<p style="font-size:12px;font-weight:700;color:#a78bfa;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 8px;">❤️ Support the Creator</p>\n' +
    '<p style="font-size:15px;color:#e2e8f0;margin:0 0 18px;line-height:1.6;">Enjoyed reading <strong style="color:#fff;">' + escHtml(title) + '</strong>?<br>Get your official physical copy and support the author directly!</p>\n' +
    '<a href="' + escHtml(url) + '" target="_blank" rel="nofollow noopener" ' +
    'style="display:inline-block;background:#ff9900;color:#000;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:800;letter-spacing:0.02em;">📖&nbsp; Get Physical Copy</a>\n' +
    '<p style="font-size:11px;color:#64748b;margin:14px 0 0;font-style:italic;">Supporting creators helps bring more great manga to life.</p>\n' +
    '</div>\n' +
    '<!-- /manga-affiliate-section -->';
}

// Strip any existing affiliate section from a description string
function stripOldSection(desc) {
  if (!desc) return '';
  var s = desc;

  // Strip HTML comment block version
  s = s.replace(/<!-- manga-affiliate-section -->[\s\S]*?<!-- \/manga-affiliate-section -->/g, '');

  // Strip the full injected div block (catches any version of our div)
  s = s.replace(/<div[^>]*manga-affiliate[^>]*>[\s\S]*?<\/div>/g, '');

  // Strip by content — any div containing "Support the Creator" or "Get Physical Copy"
  s = s.replace(/<div[\s\S]*?Support the [Cc]reator[\s\S]*?<\/div>/g, '');
  s = s.replace(/<div[\s\S]*?Get Physical Copy[\s\S]*?<\/div>/g, '');
  s = s.replace(/<div[\s\S]*?Buy on Amazon[\s\S]*?<\/div>/g, '');

  // Strip plain text version (no HTML tags — what got injected in your case)
  s = s.replace(/[📚❤️🛒📖]\s*Support the [Cc]reator[\s\S]*?qualifying purchases\./g, '');
  s = s.replace(/Support the [Cc]reator\s*Love reading[\s\S]*?qualifying purchases\./g, '');
  s = s.replace(/Support the author by buying[\s\S]*?qualifying purchases\./g, '');
  s = s.replace(/Get your official physical copy[\s\S]*?manga to life\./g, '');
  s = s.replace(/Enjoyed reading[\s\S]*?manga to life\./g, '');

  // Clean up any leftover </p> we injected
  s = s.replace(/<\/p>\s*$/, '');

  return s.trim();
}
// ── Steps ─────────────────────────────────────────────────────────────────────
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
  btn.textContent = 'Connecting…'; btn.disabled = true;

  try {
    var res = await fetch('/api/fetch-categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(wpConfig)
    });
    var data = await res.json();
    if (!res.ok) { showError('Error: ' + (data.error || ('HTTP ' + res.status))); return; }
    if (!data.categories || data.categories.length === 0) {
      showError('No categories found. Check your credentials and make sure your site has categories with posts.');
      return;
    }
    allCats = data.categories;
    buildMatches();
    goStep(2);
    renderStats();
    renderList();
  } catch(e) {
    showError('Could not reach the server. Detail: ' + e.message);
  } finally {
    btn.textContent = 'Fetch manga categories →'; btn.disabled = false;
  }
}

// ── Demo ──────────────────────────────────────────────────────────────────────
function loadDemo() {
  clearError();
  wpConfig = { wpUrl: 'http://demo', wpUser: 'admin', wpPass: 'demo' };
  allCats = [
    { id:1, name:'One Piece',        slug:'one-piece',        description:'', count:1100, link:'https://demo.site/category/one-piece/' },
    { id:2, name:'Naruto',           slug:'naruto',           description:'Naruto Uzumaki is a young ninja.<!-- manga-affiliate-section --><div>OLD SECTION</div><!-- /manga-affiliate-section -->', count:700, link:'https://demo.site/category/naruto/' },
    { id:3, name:'Attack on Titan',  slug:'attack-on-titan',  description:'', count:139,  link:'https://demo.site/category/attack-on-titan/' },
    { id:4, name:'Demon Slayer',     slug:'demon-slayer',     description:'Tanjiro becomes a demon slayer. Support the creator Love reading Demon Slayer? Buy on Amazon As an Amazon Associate I earn from qualifying purchases.', count:205, link:'https://demo.site/category/demon-slayer/' },
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

function hasOldSection(desc) {
  if (!desc) return false;
  return desc.includes('manga-affiliate-section') ||
         desc.includes('Support the creator') ||
         desc.includes('Support the Creator') ||
         desc.includes('Buy on Amazon') ||
         desc.includes('qualifying purchases');
}

function buildMatches() {
  matched = []; decisions = {}; reinject = {};
  allCats.forEach(function(cat) {
    var normName = normalize(cat.name);
    var url = null;

    // First try to match from CSV
    Object.keys(csvData).forEach(function(k) {
      var nk = normalize(k);
      if (nk === normName || normName.includes(nk) || nk.includes(normName)) url = csvData[k];
    });

    // If no CSV match, try to extract existing URL from the description
    if (!url && cat.description) {
      var urlMatch = cat.description.match(/href=["']([^"']+)["'][^>]*>\s*(?:📖|🛒|Buy|Get Physical)/);
      if (urlMatch) url = urlMatch[1];
    }

    var alreadyHas = hasOldSection(cat.description);
    matched.push({ cat: cat, url: url, title: cat.name, alreadyHas: alreadyHas });
    decisions[cat.id] = alreadyHas ? 'approved' : (url ? 'pending' : 'unmatched');
  });
}
// ── Stats ─────────────────────────────────────────────────────────────────────
function renderStats() {
  var counts = { pending:0, approved:0, skipped:0, unmatched:0 };
  matched.forEach(function(m) { counts[decisions[m.cat.id]]++; });
  var reinjectCount = Object.keys(reinject).filter(function(k){ return reinject[k]; }).length;

  document.getElementById('stat-grid').innerHTML =
    '<div class="stat"><div class="stat-label">Total</div><div class="stat-val">' + matched.length + '</div></div>' +
    '<div class="stat"><div class="stat-label">Pending</div><div class="stat-val">' + counts.pending + '</div></div>' +
    '<div class="stat"><div class="stat-label">Approved</div><div class="stat-val green">' + counts.approved + '</div></div>' +
    '<div class="stat"><div class="stat-label">Re-inject</div><div class="stat-val" style="color:#f59e0b;">' + reinjectCount + '</div></div>';

  var actionable = matched.filter(function(m){ return decisions[m.cat.id] !== 'unmatched'; }).length || 1;
  var done = matched.filter(function(m){ return decisions[m.cat.id]==='approved'||decisions[m.cat.id]==='skipped'; }).length;
  document.getElementById('prog').style.width = Math.round(done/actionable*100) + '%';

  ['pending','approved','skipped','unmatched'].forEach(function(t) {
    var el = document.getElementById('t-' + t);
    if (el) el.textContent = '(' + counts[t] + ')';
  });

  var pb = document.getElementById('publish-btn');
  var hasWork = counts.approved > 0 || reinjectCount > 0;
  if (pb) pb.disabled = !hasWork;
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
    var isReinject = !!reinject[id];
    var badgeMap = { pending:'badge-pending', approved:'badge-approved', skipped:'badge-skipped', unmatched:'badge-unmatched' };

    var currentDesc = cat.description
      ? cat.description.replace(/<[^>]+>/g,'').trim().slice(0,200) + '…'
      : '(no description yet)';

    var previewBlock = url
      ? '<div class="desc-label">Section to be added</div>' +
        '<div style="margin-top:8px;padding:18px 20px;background:#1a1a2e;border-radius:10px;border:2px solid #7c3aed;text-align:center;">' +
        '<p style="font-size:11px;font-weight:700;color:#a78bfa;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px;">❤️ Support the Creator</p>' +
        '<p style="font-size:13px;color:#e2e8f0;margin:0 0 14px;line-height:1.5;">Enjoyed reading <strong style="color:#fff;">' + escHtml(title) + '</strong>?<br>Get your official physical copy!</p>' +
        '<a href="' + escHtml(url) + '" style="display:inline-block;background:#ff9900;color:#000;text-decoration:none;padding:11px 28px;border-radius:7px;font-size:14px;font-weight:800;" target="_blank">📖&nbsp; Get Physical Copy</a>' +
        '<p style="font-size:11px;color:#64748b;margin:10px 0 0;font-style:italic;">Supporting creators helps bring more great manga to life.</p>' +
        '</div>'
      : '<div class="desc-label">No CSV match — paste URL manually</div>' +
        '<div class="manual-url-row"><input type="url" id="url-' + id + '" placeholder="https://amzn.to/..." /></div>';

    // Badge indicators
    var alreadyNote = alreadyHas && !isReinject
      ? '<span class="badge badge-exists" style="margin-left:6px;">has section</span>'
      : '';
    var reinjectNote = isReinject
      ? '<span class="badge" style="margin-left:6px;background:#fef3c7;color:#92400e;">re-inject queued</span>'
      : '';

    // Action buttons per status
    var actionsMap = {
      pending:
        '<button class="btn success" onclick="decide(' + id + ',\'approved\')">Approve ✓</button>' +
        '<button class="btn" onclick="decide(' + id + ',\'skipped\')">Skip</button>',
      approved:
        alreadyHas && !isReinject
          ? '<button class="btn" style="background:#fef3c7;color:#92400e;border-color:#fcd34d;" onclick="queueReinject(' + id + ')">🔄 Re-inject (fix old section)</button>' +
            '<button class="btn danger" onclick="decide(' + id + ',\'pending\')">Remove</button>'
          : isReinject
            ? '<button class="btn danger" onclick="cancelReinject(' + id + ')">Cancel re-inject</button>'
            : '<button class="btn danger" onclick="decide(' + id + ',\'pending\')">Undo</button>',
      skipped:
        '<button class="btn" onclick="decide(' + id + ',\'pending\')">Restore</button>',
      unmatched:
        '<button class="btn success" onclick="approveManual(' + id + ')">Add & Approve</button>'
    };

    return '<div class="manga-card" id="mc-' + id + '">' +
      '<div class="manga-card-header">' +
        '<span class="manga-title">' + escHtml(title) + alreadyNote + reinjectNote + '</span>' +
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

// ── Decisions ─────────────────────────────────────────────────────────────────
function decide(id, status) {
  decisions[id] = status;
  delete reinject[id];
  renderStats();
  renderList();
}

function queueReinject(id) {
  reinject[id] = true;
  renderStats();
  renderList();
}

function cancelReinject(id) {
  delete reinject[id];
  renderStats();
  renderList();
}

function approveManual(id) {
  var input = document.getElementById('url-' + id);
  var val = input ? input.value.trim() : '';
  if (!val) { alert('Please paste a URL first.'); return; }
  var m = matched.find(function(x){ return x.cat.id === id; });
  if (m) m.url = val;
  decisions[id] = 'approved';
  renderStats();
  renderList();
}

// ── Publish ───────────────────────────────────────────────────────────────────
function goToPublish() {
  var approved     = matched.filter(function(m){ return decisions[m.cat.id]==='approved' && !m.alreadyHas; }).length;
  var reinjectCount= Object.keys(reinject).filter(function(k){ return reinject[k]; }).length;
  var skipped      = matched.filter(function(m){ return decisions[m.cat.id]==='skipped'; }).length;
  var unmatched    = matched.filter(function(m){ return decisions[m.cat.id]==='unmatched'; }).length;

  document.getElementById('pub-stat-grid').innerHTML =
    '<div class="stat"><div class="stat-label">New</div><div class="stat-val green">' + approved + '</div></div>' +
    '<div class="stat"><div class="stat-label">Re-inject</div><div class="stat-val" style="color:#f59e0b;">' + reinjectCount + '</div></div>' +
    '<div class="stat"><div class="stat-label">Skipped</div><div class="stat-val muted">' + skipped + '</div></div>' +
    '<div class="stat"><div class="stat-label">Total</div><div class="stat-val">' + matched.length + '</div></div>';
  goStep(3);
}

function plog(msg, type) {
  type = type || 'info';
  var box  = document.getElementById('pub-log');
  var line = document.createElement('div');
  line.className = 'log-' + type;
  line.textContent = (type==='ok'?'✓  ':type==='err'?'✗  ':'   ') + msg;
  box.appendChild(line);
  box.scrollTop = box.scrollHeight;
}

async function runPublish() {
  var btn = document.getElementById('run-btn');
  btn.disabled = true; btn.textContent = 'Publishing…';
  document.getElementById('pub-log').innerHTML = '';

  // New approvals (no existing section)
  var toPublish = matched.filter(function(m){ return decisions[m.cat.id]==='approved' && !m.alreadyHas && !reinject[m.cat.id]; });
  // Re-injects (strip old + write new)
  var toReinject = matched.filter(function(m){ return !!reinject[m.cat.id]; });

  plog('New: ' + toPublish.length + '  |  Re-inject: ' + toReinject.length, 'info');

  var ok = 0, fail = 0;

  // Process new ones
  for (var i = 0; i < toPublish.length; i++) {
    var m = toPublish[i];
    await publishOne(m, false);
  }

  // Process re-injects — strip old section first, then append new one
  for (var j = 0; j < toReinject.length; j++) {
    var m = toReinject[j];
    await publishOne(m, true);
  }

  plog('Done! ' + ok + ' updated' + (fail ? ', ' + fail + ' failed' : '') + '.', 'info');
  btn.textContent = 'Run again'; btn.disabled = false;

  async function publishOne(m, isReinject) {
    var cat   = m.cat;
    var url   = m.url;
    var title = m.title;

    if (!url) { plog('"' + title + '" — skipped (no URL)', 'info'); return; }

    var cleanDesc = isReinject ? stripOldSection(cat.description) : (cat.description || '');
    var newDesc   = cleanDesc + affiliateSection(title, url);

    if (wpConfig.wpUrl === 'http://demo') {
      await new Promise(function(r){ setTimeout(r, 450); });
      plog('[DEMO] "' + title + '" — ' + (isReinject ? 're-injected' : 'updated') + ' ✓', 'ok');
      ok++; return;
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
      plog('"' + title + '" — ' + (isReinject ? 're-injected' : 'updated') + ' ✓', 'ok');
      m.alreadyHas = true;
      cat.description = newDesc;
      if (isReinject) delete reinject[cat.id];
      ok++;
    } catch(e) {
      plog('"' + title + '" — FAILED: ' + e.message, 'err');
      fail++;
    }
  }
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}