export const FAVICON_SVG = String.raw`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f766e"/><stop offset="1" stop-color="#064e3b"/></linearGradient><linearGradient id="m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset="1" stop-color="#d4a017"/></linearGradient><mask id="c"><rect width="64" height="64" fill="#fff"/><circle cx="38" cy="27" r="15" fill="#000"/></mask></defs><rect width="64" height="64" rx="15" fill="url(#g)"/><circle cx="30" cy="32" r="18" fill="url(#m)" mask="url(#c)"/><path d="M45 36l1.9 4.3 4.6.5-3.4 3.1 1 4.6-4.1-2.4-4.1 2.4 1-4.6-3.4-3.1 4.6-.5z" fill="#fde68a"/></svg>`;

export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#06231f">
<title>Analytics · Muslim Prayer Reminder</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="alternate icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap">
<link rel="stylesheet" href="/analytics/app.css?v=2">
</head>
<body>
<div id="app" aria-live="polite"><div class="boot">Loading analytics…</div></div>
<noscript><p class="boot">This dashboard needs JavaScript.</p></noscript>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js" integrity="sha384-jb8JQMbMoBUzgWatfe6COACi2ljcDdZQ2OxczGA3bGNeWe+6DChMTBJemed7ZnvJ" crossorigin="anonymous"></script>
<script src="/analytics/app.js?v=2" defer></script>
</body>
</html>`;

export const DASHBOARD_CSS = String.raw`
:root{--bg:hsl(172 48% 5%);--bg2:hsl(172 40% 8%);--card:hsl(172 34% 10%);--card2:hsl(172 30% 13%);--line:hsl(172 24% 19%);--tx:hsl(160 20% 94%);--mut:hsl(165 12% 63%);--em:hsl(158 70% 48%);--em2:hsl(168 76% 36%);--gold:hsl(43 92% 62%);--red:hsl(0 78% 66%);--blue:hsl(205 85% 66%);--vio:hsl(262 80% 74%);--r:16px}
*{box-sizing:border-box}html{color-scheme:dark}
body{margin:0;min-height:100vh;font:14px/1.5 Inter,system-ui,sans-serif;color:var(--tx);background:radial-gradient(1100px 520px at 12% -8%,hsl(168 70% 20% / .45),transparent 60%),radial-gradient(900px 480px at 100% 0,hsl(43 80% 40% / .13),transparent 55%),var(--bg);background-attachment:fixed}
.wrap{max-width:1360px;margin:0 auto;padding:22px 20px 56px}
.boot{padding:80px 0;text-align:center;color:var(--mut)}
header.top{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between;margin-bottom:18px}
.brand{display:flex;align-items:center;gap:14px}
.brand img{width:46px;height:46px;border-radius:12px;box-shadow:0 6px 24px hsl(168 80% 30% / .45)}
.brand h1{margin:0;font-size:20px;font-weight:700;letter-spacing:-.01em}
.brand p{margin:2px 0 0;color:var(--mut);font-size:12.5px}
.controls{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.seg{display:inline-flex;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:3px}
.seg button{all:unset;cursor:pointer;padding:6px 12px;border-radius:9px;font-weight:600;font-size:12.5px;color:var(--mut);transition:background .18s,color .18s}
.seg button:hover{color:var(--tx)}
.seg button[aria-pressed=true]{background:linear-gradient(135deg,var(--em2),hsl(168 70% 28%));color:#fff;box-shadow:0 2px 10px hsl(168 80% 25% / .5)}
.btn{all:unset;cursor:pointer;padding:7px 13px;border:1px solid var(--line);border-radius:11px;background:var(--card);font-weight:600;font-size:12.5px;display:inline-flex;gap:7px;align-items:center;transition:transform .15s,border-color .15s}
.btn:hover{border-color:var(--em2);transform:translateY(-1px)}
.btn:focus-visible,.seg button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.btn[aria-pressed=true]{border-color:var(--em);color:var(--em)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--em);box-shadow:0 0 0 0 hsl(158 70% 48% / .6);animation:pulse 2s infinite}
.dot.off{background:var(--mut);animation:none}
@keyframes pulse{70%{box-shadow:0 0 0 8px transparent}100%{box-shadow:0 0 0 0 transparent}}
.banner{border:1px solid;border-radius:12px;padding:11px 14px;margin:0 0 14px;font-size:13px}
.banner.warn{border-color:hsl(43 80% 40%);background:hsl(43 70% 14% / .7);color:hsl(43 90% 80%)}
.banner.info{border-color:var(--line);background:var(--card);color:var(--mut)}
.banner.err{border-color:hsl(0 60% 40%);background:hsl(0 50% 14% / .7);color:hsl(0 90% 85%)}
.grid{display:grid;gap:14px}
.kpis{grid-template-columns:repeat(auto-fill,minmax(205px,1fr));margin-bottom:14px}
.kpi{background:linear-gradient(160deg,var(--card2),var(--card));border:1px solid var(--line);border-radius:var(--r);padding:15px 16px;position:relative;overflow:hidden;animation:rise .45s both}
.kpi::after{content:"";position:absolute;inset:auto -20px -30px auto;width:90px;height:90px;border-radius:50%;background:radial-gradient(circle,hsl(158 70% 48% / .12),transparent 70%)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}
.kpi .l{color:var(--mut);font-size:12px;font-weight:500;display:flex;justify-content:space-between;gap:6px}
.kpi .v{font:700 28px/1.2 "JetBrains Mono",monospace;margin:6px 0 4px;letter-spacing:-.02em}
.kpi .d{font-size:12px;font-weight:600;color:var(--mut)}
.kpi .d.up{color:var(--em)}.kpi .d.down{color:var(--red)}
.kpi .h{font-size:11.5px;color:var(--mut);margin-top:3px}
.panels{grid-template-columns:repeat(12,1fr)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:16px;min-width:0;animation:rise .5s both}
.panel h2{margin:0 0 2px;font-size:14px;font-weight:600}
.panel .sub{margin:0 0 12px;color:var(--mut);font-size:12px}
.s12{grid-column:span 12}.s8{grid-column:span 8}.s6{grid-column:span 6}.s4{grid-column:span 4}
@media(max-width:1000px){.s8,.s6,.s4{grid-column:span 12}}
.chart{position:relative;height:280px}.chart.sm{height:230px}
.empty{display:grid;place-items:center;height:140px;color:var(--mut);font-size:13px;text-align:center}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{color:var(--mut);font-weight:600;text-align:left;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:7px 8px;border-bottom:1px solid hsl(172 24% 15%)}
td.n,th.n{text-align:right;font-family:"JetBrains Mono",monospace}
tr:last-child td{border-bottom:0}
.tw{overflow-x:auto}
.mono{font-family:"JetBrains Mono",monospace}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:11px;font-weight:600;border:1px solid var(--line);color:var(--mut)}
.pill.ok{color:var(--em);border-color:hsl(158 50% 28%)}.pill.bad{color:var(--red);border-color:hsl(0 50% 35%)}.pill.gold{color:var(--gold);border-color:hsl(43 60% 35%)}
.bars{display:grid;gap:9px}
.bar{display:grid;grid-template-columns:minmax(90px,170px) 1fr auto;gap:10px;align-items:center;font-size:12.5px}
.bar .t{background:var(--bg2);border-radius:99px;height:9px;overflow:hidden}
.bar .t i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--em2),var(--em));transition:width .7s cubic-bezier(.2,.8,.2,1)}
.bar .k{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar .c{font-family:"JetBrains Mono",monospace;color:var(--mut);font-size:12px}
.hm{display:grid;grid-template-columns:34px repeat(24,1fr);gap:3px;font-size:10.5px;color:var(--mut)}
.hm .c{aspect-ratio:1;border-radius:4px;background:hsl(158 70% 48% / .05);min-height:14px}
.hm .r{align-self:center}.hm .x{text-align:center}
.cohort td.cell{text-align:center;font-family:"JetBrains Mono",monospace;font-size:11.5px}
.insights{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:10px}
.ins{background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:11px 13px;font-size:13px}
.ins b{display:block;color:var(--gold);font-size:11px;letter-spacing:.06em;text-transform:uppercase;margin-bottom:3px}
footer{margin-top:22px;color:var(--mut);font-size:12px;border-top:1px solid var(--line);padding-top:14px}
footer ul{margin:6px 0 0;padding-left:18px}
.sk{border-radius:var(--r);background:linear-gradient(100deg,var(--card) 30%,var(--card2) 50%,var(--card) 70%);background-size:200% 100%;animation:sh 1.3s infinite;height:96px}
@keyframes sh{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

export const DASHBOARD_JS = String.raw`
(function () {
  'use strict';
  var C = { em: 'hsl(158,70%,48%)', em2: 'hsl(168,76%,36%)', gold: 'hsl(43,92%,62%)', red: 'hsl(0,78%,66%)', blue: 'hsl(205,85%,66%)', vio: 'hsl(262,80%,74%)', mut: 'hsl(165,12%,63%)', line: 'hsl(172,24%,19%)' };
  var PALETTE = [C.em, C.gold, C.blue, C.vio, C.red, 'hsl(18,90%,62%)', 'hsl(190,70%,55%)', C.mut];
  var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var state = { range: 30, segment: 'all', auto: false, data: null, timer: null, charts: {} };
  var root = document.getElementById('app');
  var nf = new Intl.NumberFormat('en-US');
  var regionNames, langNames;
  try { regionNames = new Intl.DisplayNames(['en'], { type: 'region' }); langNames = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) { regionNames = null; langNames = null; }

  function h(tag, cls, text, kids) {
    var el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined && text !== null) el.textContent = text;
    if (kids) kids.forEach(function (k) { if (k) el.appendChild(k); });
    return el;
  }
  function fmt(n) { return n === null || n === undefined ? '–' : nf.format(n); }
  function pct(n, d) { return (n * 100).toFixed(d === undefined ? 1 : d) + '%'; }
  function ago(iso) {
    if (!iso) return '–';
    var s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
    if (s < 60) return Math.floor(s) + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code)) return '';
    return String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1)) + ' ';
  }
  function country(code) { var n = ''; try { n = regionNames ? regionNames.of(code) : ''; } catch (e) { n = ''; } return flag(code) + (n || code); }
  function lang(code) { var n = ''; try { n = langNames ? langNames.of(code) : ''; } catch (e) { n = ''; } return n || code; }
  function toolName(t) { return String(t || '').replace(/^get_/, '').replace(/_/g, ' '); }
  function errName(c) { return String(c || 'unknown').replace(/_/g, ' '); }

  function destroyCharts() { Object.keys(state.charts).forEach(function (k) { state.charts[k].destroy(); }); state.charts = {}; }
  function chart(id, canvas, cfg) {
    if (typeof Chart === 'undefined') return;
    cfg.options = cfg.options || {};
    cfg.options.responsive = true;
    cfg.options.maintainAspectRatio = false;
    state.charts[id] = new Chart(canvas, cfg);
  }
  function axes(extra) {
    var o = { x: { grid: { display: false }, ticks: { color: C.mut, maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { beginAtZero: true, grid: { color: C.line }, ticks: { color: C.mut, precision: 0 } } };
    if (extra) Object.keys(extra).forEach(function (k) { o[k] = extra[k]; });
    return o;
  }
  var legend = { labels: { color: C.mut, boxWidth: 10, boxHeight: 10, usePointStyle: true } };

  function delta(cur, prev, invert) {
    var el = h('div', 'd');
    if (!prev && !cur) { el.textContent = 'no data yet'; return el; }
    if (!prev) { el.textContent = 'new this period'; el.className = 'd up'; return el; }
    var ch = (cur - prev) / prev;
    var good = invert ? ch <= 0 : ch >= 0;
    el.className = 'd ' + (Math.abs(ch) < 0.005 ? '' : good ? 'up' : 'down');
    el.textContent = (ch >= 0 ? '▲ ' : '▼ ') + Math.abs(ch * 100).toFixed(0) + '% vs prev ' + state.range + 'd';
    return el;
  }
  function kpi(label, value, deltaEl, hint, i) {
    var el = h('div', 'kpi', null, [h('div', 'l', label), h('div', 'v', value), deltaEl, hint ? h('div', 'h', hint) : null]);
    el.style.animationDelay = (i * 25) + 'ms';
    return el;
  }
  function panel(span, title, sub, body) { return h('section', 'panel ' + span, null, [h('h2', null, title), h('p', 'sub', sub), body]); }
  function emptyBox(msg) { return h('div', 'empty', msg); }
  function canvasBox(id, small) { var box = h('div', 'chart' + (small ? ' sm' : '')); var cv = document.createElement('canvas'); cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', id); box.appendChild(cv); box._cv = cv; return box; }

  function barList(items, labelFn, valueKey) {
    if (!items || !items.length) return emptyBox('No data in this period');
    var max = Math.max.apply(null, items.map(function (x) { return x[valueKey]; })) || 1;
    var wrap = h('div', 'bars');
    items.forEach(function (x) {
      var fill = h('i'); fill.style.width = Math.max(2, (x[valueKey] / max) * 100) + '%';
      wrap.appendChild(h('div', 'bar', null, [h('span', 'k', labelFn(x)), h('span', 't', null, [fill]), h('span', 'c', fmt(x[valueKey]))]));
    });
    return wrap;
  }
  function table(cols, rows, cls) {
    if (!rows.length) return emptyBox('No data in this period');
    var thead = h('tr', null, null, cols.map(function (c) { return h('th', c.n ? 'n' : '', c.h); }));
    var tbody = h('tbody');
    rows.forEach(function (r) { tbody.appendChild(h('tr', null, null, cols.map(function (c) { var cell = c.f(r); if (cell instanceof Node) { var td = h('td', c.n ? 'n' : '', null, [cell]); return td; } return h('td', c.n ? 'n' : '', cell); }))); });
    var t = h('table', cls || '', null, [h('thead', null, null, [thead]), tbody]);
    return h('div', 'tw', null, [t]);
  }

  function insights(d) {
    var out = [], k = d.kpis;
    if (d.tools.length) out.push(['Top tool', toolName(d.tools[0].tool) + ' · ' + pct(d.tools[0].calls / Math.max(1, k.current.calls), 0) + ' of calls']);
    var best = { v: 0, dow: 0, hr: 0 };
    d.heatmap.cells.forEach(function (row, dow) { row.forEach(function (v, hr) { if (v > best.v) best = { v: v, dow: dow, hr: hr }; }); });
    if (best.v) out.push(['Peak usage', DAYS[best.dow] + ' around ' + String(best.hr).padStart(2, '0') + ':00 ' + (d.heatmap.userLocalShare > 0.5 ? 'user-local time' : 'your time')]);
    var r1 = d.retention[0];
    if (r1 && r1.eligible) out.push(['Day-1 retention', pct(r1.rate, 0) + ' of ' + fmt(r1.eligible) + ' eligible users came back after a day']);
    var tot = k.current.calls, er = tot ? k.current.errors / tot : 0;
    out.push(['Reliability', tot ? (pct(1 - er) + ' of calls succeeded' + (d.errors[0] ? '; top error: ' + errName(d.errors[0].code) : '')) : 'No calls yet']);
    if (k.current.users) out.push(['Loyalty', pct(k.current.returning / k.current.users, 0) + ' of active users are returning (' + fmt(k.current.returning) + ')']);
    if (d.countries.items[0]) out.push(['Top country', country(d.countries.items[0].key) + ' · ' + fmt(d.countries.items[0].users) + ' users']);
    return h('div', 'insights', null, out.map(function (i) { return h('div', 'ins', null, [h('b', null, i[0]), h('span', null, i[1])]); }));
  }

  function heatmap(d) {
    var max = 0;
    d.heatmap.cells.forEach(function (r) { r.forEach(function (v) { if (v > max) max = v; }); });
    if (!max) return emptyBox('No activity yet');
    var g = h('div', 'hm');
    g.appendChild(h('div'));
    for (var hr = 0; hr < 24; hr++) g.appendChild(h('div', 'x', hr % 3 === 0 ? String(hr) : ''));
    d.heatmap.cells.forEach(function (row, dow) {
      g.appendChild(h('div', 'r', DAYS[dow]));
      row.forEach(function (v, hr2) {
        var c = h('div', 'c'); c.title = DAYS[dow] + ' ' + String(hr2).padStart(2, '0') + ':00 · ' + v + ' calls';
        if (v) c.style.background = 'hsl(158 70% 48% / ' + (0.15 + 0.85 * (v / max)).toFixed(2) + ')';
        g.appendChild(c);
      });
    });
    return g;
  }

  function cohortTable(d) {
    var rows = d.cohorts.filter(function (c) { return c.size > 0; });
    if (!rows.length) return emptyBox('Cohorts appear once users have been seen');
    var head = [h('th', null, 'Cohort week'), h('th', 'n', 'Users')];
    for (var i = 0; i < 8; i++) head.push(h('th', 'n', 'W' + i));
    var body = h('tbody');
    rows.forEach(function (c) {
      var tr = h('tr', null, null, [h('td', 'mono', c.week), h('td', 'n', fmt(c.size))]);
      for (var j = 0; j < 8; j++) {
        var td = h('td', 'cell', j < c.cells.length ? pct(c.cells[j], 0) : '');
        if (j < c.cells.length) td.style.background = 'hsl(158 70% 48% / ' + (0.08 + 0.7 * c.cells[j]).toFixed(2) + ')';
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
    return h('div', 'tw', null, [h('table', 'cohort', null, [h('thead', null, null, [h('tr', null, null, head)]), body])]);
  }

  function exportCsv(d) {
    var lines = ['date,calls,users,sessions,new_users,errors'];
    d.daily.forEach(function (r) { lines.push([r.date, r.calls, r.users, r.sessions, r.newUsers, r.errors].join(',')); });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
    a.download = 'prayer-mcp-analytics-' + d.range + 'd.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function controls() {
    var rangeSeg = h('div', 'seg');
    [7, 30, 90, 180].forEach(function (n) {
      var b = h('button', null, n + 'd'); b.setAttribute('aria-pressed', String(state.range === n));
      b.onclick = function () { state.range = n; load(); }; rangeSeg.appendChild(b);
    });
    var segSeg = h('div', 'seg');
    [['all', 'All traffic'], ['verified', 'Verified ChatGPT']].forEach(function (s) {
      var b = h('button', null, s[1]); b.setAttribute('aria-pressed', String(state.segment === s[0]));
      b.title = s[0] === 'verified' ? 'Only calls arriving from OpenAI published egress IPs' : 'Every call, including your own tests';
      b.onclick = function () { state.segment = s[0]; load(); }; segSeg.appendChild(b);
    });
    var refresh = h('button', 'btn', '↻ Refresh'); refresh.onclick = function () { load(); };
    var auto = h('button', 'btn', null, [h('span', 'dot' + (state.auto ? '' : ' off')), h('span', null, state.auto ? 'Auto 60s' : 'Auto off')]);
    auto.setAttribute('aria-pressed', String(state.auto));
    auto.onclick = function () { state.auto = !state.auto; schedule(); render(); };
    var csv = h('button', 'btn', 'Export CSV'); csv.onclick = function () { if (state.data && state.data.daily) exportCsv(state.data); };
    return h('div', 'controls', null, [rangeSeg, segSeg, refresh, auto, csv]);
  }

  function render() {
    destroyCharts();
    var d = state.data;
    var wrap = h('div', 'wrap');
    var logo = document.createElement('img'); logo.src = '/favicon.svg'; logo.alt = ''; logo.width = 46; logo.height = 46;
    var sub = d && d.generatedAt ? 'Updated ' + ago(d.generatedAt) + ' · times in your timezone (UTC' + (d.tz >= 0 ? '+' : '-') + Math.abs(d.tz / 60) + ')' : 'Loading';
    wrap.appendChild(h('header', 'top', null, [h('div', 'brand', null, [logo, h('div', null, null, [h('h1', null, 'Muslim Prayer Reminder · Analytics'), h('p', null, sub)])]), controls()]));

    if (!d) { var sg = h('div', 'grid kpis'); for (var s = 0; s < 8; s++) sg.appendChild(h('div', 'sk')); wrap.appendChild(sg); mount(wrap); return; }
    if (d.error) { wrap.appendChild(h('div', 'banner err', d.error)); mount(wrap); return; }
    if (d.access && d.access.protected === false) wrap.appendChild(h('div', 'banner warn', 'This dashboard is public. Set the ANALYTICS_TOKEN secret on the Worker to require a password (any username).'));
    if (d.enabled === false) wrap.appendChild(h('div', 'banner err', 'The ANALYTICS Durable Object binding is missing, so nothing is being recorded. Redeploy with the binding from wrangler.toml.'));
    if (d.legacy) wrap.appendChild(h('div', 'banner info', 'Before this version (approximate, KV-based): ' + fmt(d.legacy.totalCalls) + ' calls and ' + fmt(d.legacy.totalUniqueUsers) + ' users' + (d.legacy.firstRecordedAt ? ' since ' + d.legacy.firstRecordedAt.slice(0, 10) : '') + '. These include test traffic and are not merged into the figures below.'));
    if (d.enabled === false) { mount(wrap); return; }

    var k = d.kpis, c = k.current, p = k.previous;
    var errRate = c.calls ? c.errors / c.calls : 0, prevErr = p.calls ? p.errors / p.calls : 0;
    var errDelta = h('div', 'd'); errDelta.textContent = p.calls ? (errRate <= prevErr ? '▼ ' : '▲ ') + Math.abs((errRate - prevErr) * 100).toFixed(1) + ' pts vs prev' : 'no prior data'; errDelta.className = 'd ' + (p.calls ? (errRate <= prevErr ? 'up' : 'down') : '');
    var cards = [
      ['Active users', fmt(c.users), delta(c.users, p.users), 'Unique pseudonymous ChatGPT users'],
      ['Tool calls', fmt(c.calls), delta(c.calls, p.calls), fmt(c.anonymous) + ' without a user ID'],
      ['Conversations', fmt(c.sessions), delta(c.sessions, p.sessions), k.callsPerSession + ' calls each'],
      ['New users', fmt(c.newUsers), delta(c.newUsers, p.newUsers), 'First seen in this period'],
      ['Returning users', fmt(c.returning), delta(c.returning, p.returning), c.users ? pct(c.returning / c.users, 0) + ' of active' : ''],
      ['DAU · last 24h', fmt(k.dau), h('div', 'd', 'Avg ' + k.avgDau + '/day this period'), 'Rolling 24 hours'],
      ['WAU · last 7d', fmt(k.wau), h('div', 'd', ''), 'Rolling 7 days'],
      ['MAU · last 30d', fmt(k.mau), h('div', 'd', ''), 'Rolling 30 days'],
      ['Stickiness', pct(k.stickiness, 0), h('div', 'd', 'DAU ÷ MAU'), '20%+ is healthy for utilities'],
      ['Error rate', pct(errRate), errDelta, fmt(c.errors) + ' failed calls'],
      ['Calls per user', String(k.callsPerUser), h('div', 'd', ''), 'Identified users only'],
      ['Server time p95', k.latency.p95 === null ? '–' : k.latency.p95 + ' ms', h('div', 'd', k.latency.p50 === null ? '' : 'p50 ' + k.latency.p50 + ' ms'), 'I/O-inclusive; CPU time not shown']
    ];
    var kg = h('div', 'grid kpis');
    cards.forEach(function (x, i) { kg.appendChild(kpi(x[0], x[1], x[2], x[3], i)); });
    wrap.appendChild(kg);

    var panels = h('div', 'grid panels');
    panels.appendChild(panel('s12', 'At a glance', 'Auto-generated from the selected period', insights(d)));

    var trend = canvasBox('Users and calls per day');
    panels.appendChild(panel('s8', 'Users and calls', 'Daily active users, new users and total calls', trend));
    var donut = canvasBox('Tool share', true);
    panels.appendChild(panel('s4', 'Tool mix', 'Share of calls by tool', d.tools.length ? donut : emptyBox('No calls yet')));

    var stack = canvasBox('Calls by tool per day');
    panels.appendChild(panel('s8', 'Calls by tool over time', 'Which tools drive usage and when', Object.keys(d.toolDaily.series).length ? stack : emptyBox('No calls yet')));
    var ret = canvasBox('Retention', true);
    panels.appendChild(panel('s4', 'Retention', 'Share of users who returned at least N days after first use', d.retention[0].eligible ? ret : emptyBox('Needs users first seen 1+ days ago')));

    panels.appendChild(panel('s6', 'Weekly cohorts', 'Share of each signup week still active in later weeks', cohortTable(d)));
    panels.appendChild(panel('s6', 'When people use it', d.heatmap.userLocalShare > 0.5 ? 'Day and hour in the user local time' : 'Day and hour in your timezone (user local time unavailable for most calls)', heatmap(d)));

    var depth = canvasBox('Engagement depth', true);
    panels.appendChild(panel('s4', 'Engagement depth', 'Users by number of active days', c.users ? depth : emptyBox('No identified users yet')));
    panels.appendChild(panel('s4', 'Countries', 'Users by country. ChatGPT reports an approximate location when available', barList(d.countries.items.slice(0, 8), function (x) { return country(x.key); }, 'users')));
    panels.appendChild(panel('s4', 'Languages', 'Users by ChatGPT locale', barList(d.locales.items.slice(0, 8), function (x) { return lang(x.key); }, 'users')));

    panels.appendChild(panel('s4', 'Calculation authority', 'Which method answered prayer queries', barList(d.authorities.slice(0, 8), function (x) { return x.key; }, 'calls')));
    var srcMap = { explicit_override: 'Explicit override', stored_preference: 'Saved preference', geographic_default: 'Auto by location' };
    panels.appendChild(panel('s4', 'How the method was chosen', 'Auto-resolution vs user choices', barList(d.methodSources, function (x) { return srcMap[x.key] || x.key; }, 'calls')));
    var clientItems = d.clients.concat(d.handshakes.initialize.map(function (x) { return { key: x.key + ' (handshakes)', calls: x.n, users: x.n }; }));
    panels.appendChild(panel('s4', 'Clients', 'Calls by client; handshakes show installs and connections', barList(clientItems.slice(0, 10), function (x) { return x.key; }, 'calls')));

    panels.appendChild(panel('s6', 'Tool health', 'Calls, users, failures and average server time', table([
      { h: 'Tool', f: function (r) { return toolName(r.tool); } }, { h: 'Calls', n: 1, f: function (r) { return fmt(r.calls); } }, { h: 'Users', n: 1, f: function (r) { return fmt(r.users); } },
      { h: 'Errors', n: 1, f: function (r) { return fmt(r.errors); } }, { h: 'Error %', n: 1, f: function (r) { return pct(r.calls ? r.errors / r.calls : 0); } }, { h: 'Avg ms', n: 1, f: function (r) { return r.avgMs === null ? '–' : fmt(r.avgMs); } }
    ], d.tools)));
    panels.appendChild(panel('s6', 'Errors', 'Failed calls by type. location_required means the model asked for a city first', table([
      { h: 'Tool', f: function (r) { return toolName(r.tool); } }, { h: 'Error', f: function (r) { return h('span', 'pill bad', errName(r.code)); } }, { h: 'Count', n: 1, f: function (r) { return fmt(r.n); } }
    ], d.errors)));

    panels.appendChild(panel('s6', 'Most active users', 'Pseudonymous 8-character IDs, not reversible', table([
      { h: 'User', f: function (r) { return h('span', 'mono', r.id); } }, { h: 'Calls', n: 1, f: function (r) { return fmt(r.calls); } }, { h: 'Days', n: 1, f: function (r) { return fmt(r.days); } },
      { h: 'Tools', n: 1, f: function (r) { return fmt(r.tools); } }, { h: 'First seen', f: function (r) { return r.firstSeen ? r.firstSeen.slice(0, 10) : '–'; } }, { h: 'Last', f: function (r) { return ago(r.lastSeen); } }
    ], d.topUsers)));
    panels.appendChild(panel('s6', 'Live activity', 'Last 30 events', table([
      { h: 'When', f: function (r) { return ago(r.ts); } },
      { h: 'Event', f: function (r) { return r.kind === 'tool' ? toolName(r.tool) : r.kind; } },
      { h: 'Client', f: function (r) { return r.client || '–'; } },
      { h: 'Where', f: function (r) { return r.country ? flag(r.country) + r.country : '–'; } },
      { h: 'Result', f: function (r) { return h('span', 'pill ' + (r.status === 'ok' ? 'ok' : 'bad'), r.status === 'ok' ? 'ok' : errName(r.code)); } },
      { h: 'Src', f: function (r) { return r.verified ? h('span', 'pill gold', 'OpenAI') : h('span', 'pill', 'other'); } }
    ], d.recent)));
    wrap.appendChild(panels);

    var a = d.allTime;
    wrap.appendChild(h('footer', null, null, [
      h('div', null, 'All-time since ' + (a.since ? a.since.slice(0, 10) : 'launch') + ': ' + fmt(a.calls) + ' calls, ' + fmt(a.users) + ' unique users. Events kept 180 days, user rows 400 days.'),
      h('ul', null, null, [
        h('li', null, 'Users are counted from the anonymous ChatGPT subject ID. Calls without one are counted as calls but not as users.'),
        h('li', null, 'Installs that never call a tool are invisible to the server. OpenAI exposes no install counter.'),
        h('li', null, 'The Verified segment uses OpenAI published egress IPs. IP addresses are never stored. Metadata from other clients can be spoofed.'),
        h('li', null, 'Country is the location ChatGPT reports for the user, not the connection origin. Calls without it are left out of the country chart.'),
        h('li', null, 'Server time covers I/O waits only. Workers do not advance their clock during pure computation.')
      ])
    ]));
    mount(wrap);

    chart('trend', trend._cv, { data: { labels: d.daily.map(function (x) { return x.date.slice(5); }), datasets: [
      { type: 'bar', label: 'Calls', data: d.daily.map(function (x) { return x.calls; }), backgroundColor: 'hsla(158,70%,48%,.28)', borderRadius: 4, yAxisID: 'y1', order: 3 },
      { type: 'line', label: 'Active users', data: d.daily.map(function (x) { return x.users; }), borderColor: C.gold, backgroundColor: C.gold, tension: .3, pointRadius: d.range > 30 ? 0 : 3, order: 1 },
      { type: 'line', label: 'New users', data: d.daily.map(function (x) { return x.newUsers; }), borderColor: C.blue, backgroundColor: C.blue, tension: .3, pointRadius: d.range > 30 ? 0 : 3, borderDash: [5, 4], order: 2 }
    ] }, options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: legend }, scales: axes({ y1: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { color: C.mut, precision: 0 } } }) } });

    if (d.tools.length) chart('donut', donut._cv, { type: 'doughnut', data: { labels: d.tools.map(function (t) { return toolName(t.tool); }), datasets: [{ data: d.tools.map(function (t) { return t.calls; }), backgroundColor: PALETTE, borderColor: 'hsl(172,34%,10%)', borderWidth: 3 }] }, options: { cutout: '64%', plugins: { legend: { position: 'bottom', labels: legend.labels } } } });

    var names = Object.keys(d.toolDaily.series);
    if (names.length) chart('stack', stack._cv, { type: 'bar', data: { labels: d.toolDaily.dates.map(function (x) { return x.slice(5); }), datasets: names.map(function (n, i) { return { label: toolName(n), data: d.toolDaily.series[n], backgroundColor: PALETTE[i % PALETTE.length], borderRadius: 2 }; }) }, options: { interaction: { mode: 'index', intersect: false }, plugins: { legend: legend }, scales: { x: Object.assign({ stacked: true }, axes().x), y: Object.assign({ stacked: true }, axes().y) } } });

    if (d.retention[0].eligible) chart('ret', ret._cv, { type: 'bar', data: { labels: d.retention.map(function (r) { return 'Day ' + r.day + '+'; }), datasets: [{ data: d.retention.map(function (r) { return r.rate * 100; }), backgroundColor: [C.em, C.gold, C.blue], borderRadius: 8 }] }, options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (ctx) { var r = d.retention[ctx.dataIndex]; return r.retained + ' of ' + r.eligible + ' users (' + ctx.parsed.y.toFixed(0) + '%)'; } } } }, scales: { x: axes().x, y: Object.assign({}, axes().y, { max: 100, ticks: { color: C.mut, callback: function (v) { return v + '%'; } } }) } } });

    if (c.users) chart('depth', depth._cv, { type: 'bar', data: { labels: d.depth.map(function (x) { return x.bucket + (x.bucket === '1' ? ' day' : ' days'); }), datasets: [{ data: d.depth.map(function (x) { return x.users; }), backgroundColor: C.vio, borderRadius: 6 }] }, options: { plugins: { legend: { display: false } }, scales: axes() } });
  }

  function mount(node) { root.replaceChildren(node); }

  function load() {
    var tz = -new Date().getTimezoneOffset();
    var url = '/api/analytics?range=' + state.range + '&segment=' + state.segment + '&tz=' + tz;
    fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (r.status === 401) throw new Error('Not authorized. Reload the page and sign in with your analytics token as the password.'); if (!r.ok) throw new Error('Analytics request failed (HTTP ' + r.status + ').'); return r.json(); })
      .then(function (data) { state.data = data; render(); })
      .catch(function (e) { state.data = { error: e.message }; render(); });
  }
  function schedule() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (state.auto) state.timer = setInterval(function () { if (!document.hidden) load(); }, 60000);
  }
  render(); load();
})();
`;
