export { DASHBOARD_CSS } from './real-dashboard-style.ts';

export const DASHBOARD_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#031710">
<title>User analytics · Muslim Prayer Reminder</title>
<link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="/analytics/app.css?v=5">
</head><body><div id="app" aria-live="polite"><div class="boot">Loading analytics…</div></div>
<noscript>JavaScript is needed to view analytics.</noscript><script src="/analytics/app.js?v=5" defer></script></body></html>`;

export const DASHBOARD_JS = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('app'), range = 30, seq = 0;
  var snapshots = new Map();
  var emerald = '#4de6af', gold = '#e8cc87';
  var names;
  try { names = new Intl.DisplayNames(['en'], { type: 'region' }); } catch (_) {}
  function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = String(text); return e; }
  function add(parent, child) { parent.appendChild(child); return child; }
  function svg(tag, attrs, text) {
    var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(function (key) { e.setAttribute(key, String(attrs[key])); });
    if (text !== undefined) e.textContent = String(text);
    return e;
  }
  function icon(type) {
    var paths = {
      calendar: 'M5 3v4M19 3v4M3 10h18M5 5h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2',
      people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
      refresh: 'M21 7v5h-5M3 17v-5h5M5 7a8 8 0 0 1 13-2l3 3M3 16l3 3a8 8 0 0 0 13-2',
      search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0'
    };
    var e = svg('svg', {viewBox:'0 0 24 24',class:'icon','aria-hidden':'true'});
    add(e,svg('path',{d:paths[type]})); return e;
  }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString('en-US') : '—'; }
  function share(n, total) { return total > 0 ? (n / total * 100).toFixed(1).replace('.0','') + '%' : '0%'; }
  function dateLabel(value) { return new Date(value + 'T00:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}); }
  function lineChart(parent, days) {
    if (!days.length) { add(parent,h('p','sub','No activity in this period.')); return; }
    var w=820, height=252, left=30, right=8, top=12, bottom=32, floor=height-bottom;
    var peak = days.reduce(function (best,d) { return d.users > best.users ? d : best; },days[0]);
    var maximum = Math.max(4,Math.ceil(peak.users / 4)*4), plotW=w-left-right, plotH=floor-top;
    var chart=add(parent,svg('svg',{viewBox:'0 0 '+w+' '+height,class:'chart-svg',role:'img','aria-label':'Daily active users across '+days.length+' UTC days. Peak '+peak.users+' on '+peak.date+'.'}));
    var defs=add(chart,svg('defs',{})), gradient=add(defs,svg('linearGradient',{id:'activity-fill',x1:'0',y1:'0',x2:'0',y2:'1'}));
    add(gradient,svg('stop',{offset:'0%','stop-color':emerald,'stop-opacity':'.3'}));
    add(gradient,svg('stop',{offset:'100%','stop-color':emerald,'stop-opacity':'.015'}));
    for(var n=0;n<=4;n++) {
      var y=top+plotH*n/4;
      add(chart,svg('line',{x1:left,y1:y,x2:w-right,y2:y,class:'chart-grid'}));
      add(chart,svg('text',{x:left-12,y:y+4,'text-anchor':'end',class:'axis-label'},fmt(maximum-maximum*n/4)));
    }
    var points=days.map(function(d,i){return [left+plotW*i/Math.max(1,days.length-1),floor-plotH*d.users/maximum];});
    var path=points.map(function(p,i){return (i?'L':'M')+p[0].toFixed(2)+' '+p[1].toFixed(2);}).join(' ');
    add(chart,svg('path',{d:path+' L'+points[points.length-1][0]+' '+floor+' L'+left+' '+floor+' Z',fill:'url(#activity-fill)'}));
    add(chart,svg('path',{d:path,class:'chart-line'}));
    var interval=Math.max(1,Math.ceil((days.length-1)/6));
    days.forEach(function(d,i){
      var p=points[i];
      if(i%interval===0 || i===days.length-1) {
        if(i!==days.length-1 && days.length-1-i < interval/2) return;
        add(chart,svg('text',{x:p[0],y:height-6,'text-anchor':i===0?'start':i===days.length-1?'end':'middle',class:'axis-label'},dateLabel(d.date)));
      }
    });
    var readout=add(parent,h('div','chart-readout'));
    var detail=add(readout,h('span','','Hover or focus a point to explore'));
    add(readout,h('span','','Peak '+fmt(peak.users)+' · '+dateLabel(peak.date)));
    points.forEach(function(p,i){
      var g=add(chart,svg('g',{}));
      var hit=add(g,svg('circle',{cx:p[0],cy:p[1],r:9,class:'chart-hit',tabindex:0,'aria-label':days[i].date+': '+days[i].users+' active users'}));
      add(hit,svg('title',{},days[i].date+' · '+fmt(days[i].users)+' active users'));
      if(days.length<=35 || days[i].users===peak.users) add(g,svg('circle',{cx:p[0],cy:p[1],r:3.5,class:'chart-point','pointer-events':'none'}));
      function inspect(){detail.textContent=dateLabel(days[i].date)+' · '+fmt(days[i].users)+' active users';}
      hit.onmouseenter=inspect; hit.onfocus=inspect; hit.onclick=inspect;
    });
  }
  function audience(parent,s) {
    var body=add(parent,h('div','audience-body')), ring=add(body,h('div','ring'));
    var chart=add(ring,svg('svg',{viewBox:'0 0 180 180',role:'img','aria-label':fmt(s.newUsers)+' first-seen users and '+fmt(s.returningUsers)+' returning users'}));
    add(chart,svg('circle',{cx:90,cy:90,r:72,fill:'none',stroke:'#294a3b','stroke-width':20}));
    if(s.currentUsers>0) {
      var arc=s.newUsers/s.currentUsers*452.389;
      add(chart,svg('circle',{cx:90,cy:90,r:72,fill:'none',stroke:gold,'stroke-width':20}));
      add(chart,svg('circle',{cx:90,cy:90,r:72,fill:'none',stroke:emerald,'stroke-width':20,'stroke-dasharray':arc+' '+452.389}));
    }
    var center=add(ring,h('div','ring-center'));
    add(center,h('strong','',fmt(s.currentUsers)));add(center,h('span','','total users'));
    var legend=add(body,h('div','legend'));
    [['First seen',s.newUsers,''],['Returning',s.returningUsers,'returning']].forEach(function(x){
      var row=add(legend,h('div','legend-row'));
      add(row,h('span','legend-dot '+x[2]));add(row,h('span','legend-name',x[0]));add(row,h('span','legend-value',fmt(x[1])));add(row,h('span','legend-share',share(x[1],s.currentUsers)));
    });
    var userDays=add(legend,h('div','user-days'));add(userDays,icon('calendar'));
    var text=add(userDays,h('div'));add(text,h('div','label','User-days'));add(text,h('strong','',fmt(s.userDays)));
  }
  function countries(parent,data) {
    var geo=data.countries || {items:[],unknownUsers:data.summary.currentUsers}, total=data.summary.currentUsers;
    var top=add(parent,h('div','country-top')), title=add(top,h('div'));
    add(title,h('h2','section-title','All user countries'));add(title,h('p','sub','Active users by country · Last '+range+' days'));
    var searchWrap=add(top,h('label','search-wrap'));add(searchWrap,icon('search'));
    var search=add(searchWrap,h('input'));search.type='search';search.placeholder='Search countries…';search.setAttribute('aria-label','Find a country');
    var grid=add(parent,h('div','country-grid')), wrap=add(grid,h('div','table-wrap'));
    var table=add(wrap,h('table')), head=add(table,h('thead')), row=add(head,h('tr'));
    ['Country','Active users','Share'].forEach(function(x,i){add(row,h('th',i===1?'num':'',x));});
    var tbody=add(table,h('tbody'));
    var items=geo.items.map(function(c){return {code:c.code,name:names?names.of(c.code):c.code,users:c.users};});
    items.push({code:'',name:'Unknown / not provided',users:geo.unknownUsers});
    function draw(){
      tbody.replaceChildren();var query=search.value.trim().toLowerCase(), visible=0;
      items.forEach(function(item){
        if(query && !(item.name+' '+item.code).toLowerCase().includes(query))return;
        visible++;var tr=add(tbody,h('tr')), country=add(add(tr,h('td')),h('div','country-name'));
        add(country,h('span','country-mark'+(item.code?' known':'')));add(country,h('span','',item.name));
        if(item.code)add(country,h('span','country-code',item.code));
        add(tr,h('td','num',fmt(item.users)));
        var cell=add(add(tr,h('td','share-cell')),h('div','share-content'));add(cell,h('span','num',share(item.users,total)));
        var track=add(cell,h('div','share-track')),fill=add(track,h('div','share-fill'));fill.style.width=(total?item.users/total*100:0)+'%';
      });
      if(!visible){var tr=add(tbody,h('tr')),cell=add(tr,h('td','empty-match','No matching countries'));cell.colSpan=3;}
    }
    search.oninput=draw;draw();
    var known=total-geo.unknownUsers, coverage=add(grid,h('div','coverage'));
    var circle=add(coverage,svg('svg',{viewBox:'0 0 48 48',class:'coverage-ring','aria-hidden':'true'}));
    add(circle,svg('circle',{cx:24,cy:24,r:20,fill:'#15372b',stroke:'#426353','stroke-width':1.5}));
    if(known>0)add(circle,svg('circle',{cx:24,cy:24,r:20,fill:'none',stroke:emerald,'stroke-width':3,'stroke-dasharray':(total?known/total*125.66:0)+' 125.66',transform:'rotate(-90 24 24)'}));
    var text=add(coverage,h('div'));add(text,h('div','coverage-title',fmt(known)+' of '+fmt(total)+' users have a country'));
    add(text,h('p','sub',geo.unknownUsers?'Country data starts from new activity':'All active users have country data'));
  }
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
    var wrap=add(root,h('main','wrap')),top=add(wrap,h('header','top')),brand=add(top,h('div','brand'));
    var logo=add(brand,h('img'));logo.src='/apple-touch-icon.png';logo.alt='';logo.width=58;logo.height=58;
    var text=add(brand,h('div'));add(text,h('h1','','Muslim Prayer Reminder'));add(text,h('p','','User analytics'));
    var controls=add(top,h('div','controls')),seg=add(controls,h('div','seg'));
    seg.setAttribute('aria-label','Reporting period');
    [7,30,90,180].forEach(function(n){var b=add(seg,h('button','',n+'d'));b.type='button';b.setAttribute('aria-pressed',String(n===range));b.onclick=function(){range=n;load();};});
    var refresh=add(controls,h('button','icon-button'));refresh.type='button';refresh.setAttribute('aria-label','Reload snapshot');refresh.title='Reload daily snapshot';add(refresh,icon('refresh'));refresh.onclick=function(){snapshots.delete(range);load();};
    if(!data){var loading=add(wrap,h('div','loading')),inside=add(loading,h('div'));add(inside,h('div','loader'));add(inside,h('span','','Loading snapshot…'));return;}
    if(data.error || !data.enabled){var error=add(wrap,h('div','error',data.error || 'Analytics are not available.'));var retry=add(error,h('button','','Try again'));retry.onclick=load;return;}
    if(data.trackingLimitReached)add(wrap,h('div','cap','Daily tracking limit reached. Counts resume on the next UTC day.'));
    var s=data.summary,overview=add(wrap,h('div','overview')),hero=add(overview,h('section','panel hero'));
    var hi=add(hero,icon('people'));hi.classList.add('hero-icon');
    var main=add(hero,h('div'));add(main,h('h2','','Active users'));add(main,h('div','hero-number',fmt(s.currentUsers)));add(main,h('p','period','Last '+range+' days'));
    var comparison=add(hero,h('div','comparison'));add(comparison,h('div','label','Previous period'));add(comparison,h('strong','',fmt(s.previousUsers)));
    var change=s.previousUsers===null?'Outside retained history':s.currentUsers===s.previousUsers?'No change':s.previousUsers===0?'No previous users':((s.currentUsers-s.previousUsers)/s.previousUsers*100>0?'+':'')+((s.currentUsers-s.previousUsers)/s.previousUsers*100).toFixed(1)+'% vs previous period';
    add(comparison,h('div','delta',change));
    var rolling=add(overview,h('section','panel rolling'));rolling.setAttribute('aria-label','Daily, weekly and monthly active users');
    [['Daily',s.dau,'UTC today'],['Weekly',s.wau,'Last 7 days'],['Monthly',s.mau,'Last 30 days']].forEach(function(x){var m=add(rolling,h('div','metric'));add(m,icon('calendar'));add(m,h('span','label',x[0]));add(m,h('strong','',fmt(x[1])));add(m,h('span','hint',x[2]));});
    var charts=add(wrap,h('div','charts')),activity=add(charts,h('section','panel chart-panel'));
    add(activity,h('h2','section-title','Daily activity'));add(activity,h('p','sub','Active users per day · Last '+range+' days'));lineChart(activity,data.daily);
    var a=add(charts,h('section','panel audience'));add(a,h('h2','section-title','Audience'));add(a,h('p','sub','Unique users · Last '+range+' days'));audience(a,s);
    countries(add(wrap,h('section','panel countries')),data);
    var footer=add(wrap,h('footer')),note=add(footer,h('div','foot-note'));
    add(note,h('div','','Last updated: '+new Date(data.generatedAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC'));
    add(note,h('div','','Daily analytics snapshot. Data may be up to 24 hours old.'));
    var details=add(footer,h('details','methodology'));add(details,h('summary','','About these numbers'));
    add(details,h('p','','Only identified ChatGPT tool activity from verified OpenAI networks is counted. This signal cannot prove that every call was human initiated. Known bots and anonymous traffic are excluded.'));
    add(details,h('p','','Each user counts once per UTC day, with up to '+data.trackingLimit+' users recorded daily and '+data.retentionDays+' days of history. First seen means first observed within retained history.'));
    add(details,h('p','','Countries use approximate ChatGPT location metadata. Missing and historical locations remain Unknown. Each user appears under their latest recorded known country in the selected period.'));
  }
  load();
})();
`;
