export { DASHBOARD_CSS } from './dashboard.ts';

export const DASHBOARD_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark">
<title>Real users · Muslim Prayer Reminder</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="stylesheet" href="/analytics/app.css?v=4">
</head><body><div id="app" aria-live="polite"><div class="boot">Loading real users…</div></div>
<noscript>JavaScript is needed to view analytics.</noscript>
<script src="/analytics/app.js?v=4" defer></script></body></html>`;

export const DASHBOARD_JS = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('app'), range = 30, seq = 0;
  var snapshots = new Map();
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = String(text); return e; }
  function add(p, x) { p.appendChild(x); return x; }
  function fmt(x) { return typeof x === 'number' ? x.toLocaleString('en-US') : '–'; }
  function load() {
    var id = ++seq;
    var cached = snapshots.get(range);
    if (cached && cached.day === new Date().toISOString().slice(0,10)) { show(cached.data); return; }
    show(null);
    fetch('/api/analytics?range=' + range, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw Error('Analytics unavailable (HTTP ' + r.status + ')'); return r.json(); })
      .then(function (data) { snapshots.set(data.range, { day: new Date().toISOString().slice(0,10), data: data }); if (id === seq) show(data); })
      .catch(function (e) { if (id === seq) show({ error: e.message }); });
  }
  function show(data) {
    root.replaceChildren();
    var wrap = add(root, h('div', 'wrap'));
    var top = add(wrap, h('header', 'top'));
    var brand = add(top, h('div', 'brand'));
    var logo = add(brand, h('img')); logo.src = '/apple-touch-icon.png'; logo.alt = '';
    var text = add(brand, h('div'));
    add(text, h('h1', '', 'Muslim Prayer Reminder · Real Users'));
    add(text, h('p', '', 'Identified ChatGPT activity · UTC dates'));
    var controls = add(top, h('div', 'controls'));
    var seg = add(controls, h('div', 'seg'));
    [7, 30, 90, 180].forEach(function (n) {
      var b = add(seg, h('button', '', n + 'd')); b.type = 'button';
      b.setAttribute('aria-pressed', String(n === range));
      b.onclick = function () { range = n; load(); };
    });
    var refresh = add(controls, h('button', 'btn', 'Reload snapshot'));
    refresh.type = 'button'; refresh.onclick = load;
    if (!data) { add(wrap, h('div', 'boot', 'Loading snapshot…')); return; }
    if (data.error) { add(wrap, h('p', 'banner err', data.error)); return; }
    if (!data.enabled) { add(wrap, h('p', 'banner err', 'Analytics are not available.')); return; }
    if (!data.access?.protected) add(wrap, h('div', 'banner warn', 'The dashboard is currently public. Configure ANALYTICS_TOKEN to protect it.'));
    if (data.trackingLimitReached) add(wrap, h('div', 'banner warn', 'Daily tracking cap reached. Additional activity is not recorded until the next UTC day.'));
    add(wrap, h('div', 'banner info', 'Only identified ChatGPT tool usage is recorded, once per user per UTC day. Anonymous traffic, known bots and connection checks are excluded. Only a hashed user-day and optional approximate country are stored. Snapshots are cached for the UTC day.'));
    var s = data.summary, grid = add(wrap, h('div', 'grid kpis'));
    [
      ['Active users', s.currentUsers, 'Unique users in the selected period'],
      ['Previous period', s.previousUsers, 'Unique users in preceding period (when retained)'],
      ['Daily active', s.dau, 'UTC today'],
      ['Weekly active', s.wau, 'Last 7 UTC days'],
      ['Monthly active', s.mau, 'Last 30 UTC days'],
      ['User-days', s.userDays, 'Sum of daily distinct users'],
      ['First seen', s.newUsers, 'First observed in available 180-day history'],
      ['Returning', s.returningUsers, 'Previously seen in retained history']
    ].forEach(function (item) {
      var card = add(grid, h('div', 'kpi'));
      add(card, h('div', 'l', item[0]));
      add(card, h('div', 'v', fmt(item[1])));
      add(card, h('div', 'h', item[2]));
    });
    var panels = add(wrap, h('div', 'grid panels'));
    var panel = add(panels, h('section', 'panel s12'));
    add(panel, h('h2', '', 'Verified daily active users'));
    add(panel, h('p', 'sub', 'Last ' + Math.min(range, 30) + ' UTC days; totals above cover the selected period.'));
    var days = data.daily.slice(-30);
    var maximum = Math.max(1, ...days.map(function (x) { return x.users; }));
    var bars = add(panel, h('div', 'bars'));
    days.forEach(function (d) {
      var row = add(bars, h('div', 'bar'));
      add(row, h('span', 'k', d.date));
      var track = add(row, h('span', 't'));
      var fill = add(track, h('i')); fill.style.width = (d.users / maximum * 100) + '%';
      add(row, h('span', 'c', fmt(d.users)));
    });
    var countryPanel = add(panels, h('section', 'panel s12'));
    add(countryPanel, h('h2', '', 'All user countries'));
    var geo = data.countries || { items: [], unknownUsers: s.currentUsers };
    add(countryPanel, h('p', 'sub', geo.source || 'Approximate country supplied by ChatGPT when available.'));
    var search = add(countryPanel, h('input', 'btn'));
    search.type = 'search'; search.placeholder = 'Find a country'; search.setAttribute('aria-label', 'Find a country');
    var table = add(countryPanel, h('table')), head = add(table, h('thead')), hr = add(head, h('tr'));
    ['Country', 'Users', 'Share of active users'].forEach(function (label) { add(hr, h('th', '', label)); });
    var body = add(table, h('tbody'));
    var names;
    try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (_) {}
    var countries = geo.items.map(function (item) { return { code: item.code, name: names ? names.of(item.code) : item.code, users: item.users }; });
    countries.push({code: '', name: 'Unknown / not provided', users: geo.unknownUsers});
    function drawCountries() {
      body.replaceChildren();
      var query = search.value.trim().toLowerCase(), visible = 0;
      countries.forEach(function (item) {
        if (query && !(item.name + ' ' + item.code).toLowerCase().includes(query)) return;
        visible++;
        var row = add(body, h('tr'));
        add(row, h('td', '', item.name + (item.code ? ' (' + item.code + ')' : '')));
        add(row, h('td', '', fmt(item.users)));
        add(row, h('td', '', s.currentUsers ? (item.users / s.currentUsers * 100).toFixed(1) + '%' : '0%'));
      });
      if (!visible) { var row = add(body, h('tr')), cell = add(row, h('td', '', 'No matching countries')); cell.colSpan = 3; }
    }
    search.oninput = drawCountries; drawCountries();
    add(countryPanel, h('p', 'sub', 'Each user counts once in the selected period. Missing and historical locations stay Unknown. Locations are approximate, not proof of residence. Counts follow the existing daily tracking cap.'));
    var when = new Date(data.generatedAt).toLocaleString(undefined, { timeZone: 'UTC', timeZoneName: 'short' });
    add(wrap, h('footer', '', 'Snapshot: ' + when + ' · UTC timezone · Data retained 180 days · Maximum ' + data.trackingLimit + ' recorded users each UTC day.'));
  }
  load();
})();
`;
