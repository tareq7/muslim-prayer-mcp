export { DASHBOARD_CSS } from './dashboard.ts';

export const DASHBOARD_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark">
<title>Real users · Muslim Prayer Reminder</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="stylesheet" href="/analytics/app.css?v=3">
</head><body><div id="app" aria-live="polite"><div class="boot">Loading real users…</div></div>
<noscript>JavaScript is needed to view analytics.</noscript>
<script src="/analytics/app.js?v=3" defer></script></body></html>`;

export const DASHBOARD_JS = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('app'), range = 30, seq = 0;
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = String(text); return e; }
  function add(p, x) { p.appendChild(x); return x; }
  function fmt(x) { return typeof x === 'number' ? x.toLocaleString('en-US') : '–'; }
  function load() {
    var id = ++seq;
    show(null);
    fetch('/api/analytics?range=' + range, { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw Error('Analytics unavailable (HTTP ' + r.status + ')'); return r.json(); })
      .then(function (data) { if (id === seq) show(data); })
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
    var refresh = add(controls, h('button', 'btn', 'Refresh'));
    refresh.type = 'button'; refresh.onclick = load;
    if (!data) { add(wrap, h('div', 'boot', 'Loading snapshot…')); return; }
    if (data.error) { add(wrap, h('p', 'banner err', data.error)); return; }
    if (!data.enabled) { add(wrap, h('p', 'banner err', 'Analytics are not available.')); return; }
    if (!data.access.protected) add(wrap, h('div', 'banner warn', 'The dashboard is currently public. Configure ANALYTICS_TOKEN to protect it.'));
    if (data.trackingLimitReached) add(wrap, h('div', 'banner warn', 'Daily tracking cap reached. Additional activity is not recorded until the next UTC day.'));
    add(wrap, h('div', 'banner info', 'Only identified ChatGPT tool usage is recorded, once per user per UTC day. No bots, anonymous requests, connection checks, sessions, IP addresses or per-call logs. Snapshots are cached for the UTC day.'));
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
    add(panel, h('p', 'sub', 'Last 30 calendar days; totals above cover the selected period.'));
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
    var when = new Date(data.generatedAt).toLocaleString();
    add(wrap, h('footer', '', 'Snapshot: ' + when + ' · UTC timezone · Data retained 180 days · Maximum ' + data.trackingLimit + ' recorded users each UTC day.'));
  }
  load();
})();
`;
