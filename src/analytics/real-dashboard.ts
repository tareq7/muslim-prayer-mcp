export { DASHBOARD_CSS } from './real-dashboard-style.ts';

export const DASHBOARD_HTML = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><meta name="color-scheme" content="dark"><meta name="theme-color" content="#031710">
<title>User analytics · Muslim Prayer Reminder</title>
<link rel="icon" type="image/png" href="/favicon.png"><link rel="stylesheet" href="/analytics/app.css?v=9">
</head><body><div id="app" aria-live="polite"><div class="boot">Loading analytics…</div></div>
<noscript>JavaScript is needed to view analytics.</noscript><script src="/analytics/app.js?v=9" defer></script></body></html>`;

export const DASHBOARD_JS = String.raw`
(function () {
  'use strict';
  var root = document.getElementById('app'), range = 30, seq = 0;
  var snapshots = new Map();
  var chartCleanup = null;
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
    var colors=[emerald,gold], fields=['users','newUsers'], labels=['Active users','New users'];
    var visible=[true,true], selected=days.length-1, pinned=false, isOpen=false, frame=0, pendingX=0;
    var width=0, layout, crosshair, markers=[], xTicks=[], bottomTag, dateTag, surface, observer;
    var peak=days.reduce(function(best,d){return d.users>best.users?d:best;},days[0]);
    var toolbar=add(parent,h('div','chart-toolbar')),legend=add(toolbar,h('div','chart-legend'));
    var keys=labels.map(function(label,i){
      var key=add(legend,h('button','chart-key '+(i?'new':'active')));
      key.type='button';key.setAttribute('aria-pressed','true');key.setAttribute('aria-label','Show '+label.toLowerCase());
      add(key,h('i'));add(key,h('span','',label));
      key.onclick=function(){
        if(visible[i] && !visible[1-i])return;
        visible[i]=!visible[i];draw(true);
      };
      return key;
    });
    add(toolbar,h('span','chart-unit','Daily · UTC'));
    var stage=add(parent,h('div','chart-stage'));
    var chart=add(stage,svg('svg',{class:'chart-svg','aria-label':'Interactive daily activity chart',role:'group'}));
    var tip=add(stage,h('div','chart-tooltip'));tip.hidden=true;tip.setAttribute('role','tooltip');tip.id='daily-chart-tooltip';
    var tipHead=add(tip,h('div','tooltip-head')),tipDate=add(tipHead,h('strong')),tipPin=add(tipHead,h('span','tooltip-pin'));
    var tipRows=labels.map(function(label,i){
      var row=add(tip,h('div','tooltip-row')),name=add(row,h('span','tooltip-label'));
      add(name,h('i',i?'new':''));add(name,h('span','',label));
      var value=add(row,h('strong','tooltip-value')),change=add(row,h('span','tooltip-change'));
      return {row:row,value:value,change:change};
    });
    var tipFoot=add(tip,h('div','tooltip-foot'));
    var footer=add(parent,h('div','chart-readout'));
    var hint=add(footer,h('span','','Hover to explore · Click to pin · ← → to move'));
    add(footer,h('span','','Peak '+fmt(peak.users)+' · '+dateLabel(peak.date)));
    function fullDate(d){return new Date(d+'T00:00:00Z').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});}
    function summary(i){return fullDate(days[i].date)+'. '+fmt(days[i].users)+' active users, '+fmt(days[i].newUsers || 0)+' new users.';}
    function setOpen(open){
      isOpen=open;tip.hidden=!open;
      if(crosshair)crosshair.setAttribute('visibility',open?'visible':'hidden');
      if(bottomTag)bottomTag.setAttribute('visibility',open?'visible':'hidden');
      if(!open){hint.textContent='Hover to explore · Click to pin · ← → to move';xTicks.forEach(function(tick){tick.node.setAttribute('visibility','visible');});}
    }
    function inspect(index){
      if(!layout)return;
      selected=Math.max(0,Math.min(days.length-1,Math.round(index)));
      var d=days[selected], x=layout.x(selected);
      tipDate.textContent=fullDate(d.date);
      tipPin.textContent=pinned?'Pinned':'';
      tip.classList.toggle('is-pinned',pinned);
      tipFoot.textContent=pinned?'Δ vs previous day · Esc to release':'Δ vs previous day · Click to pin';
      tipRows.forEach(function(row,i){
        row.row.hidden=!visible[i];
        var value=d[fields[i]] || 0,prev=selected>0?(days[selected-1][fields[i]] || 0):null;
        row.value.textContent=fmt(value);
        row.change.textContent=prev===null?'—':(value-prev>0?'+':'')+fmt(value-prev);
        row.change.title=prev===null?'Previous day is outside the selected period':'Change from the previous UTC day';
        markers[i].setAttribute('cx',x);markers[i].setAttribute('cy',layout.y(value));
        markers[i].setAttribute('visibility',visible[i]?'visible':'hidden');
      });
      crosshair.querySelector('line').setAttribute('x1',x);
      crosshair.querySelector('line').setAttribute('x2',x);
      var tagX=Math.max(layout.left+38,Math.min(width-layout.right-38,x));
      bottomTag.setAttribute('transform','translate('+tagX+' '+(layout.floor+20)+')');
      dateTag.textContent=dateLabel(d.date);
      xTicks.forEach(function(tick){tick.node.setAttribute('visibility',Math.abs(tick.x-tagX)<48?'hidden':'visible');});
      surface.setAttribute('aria-valuenow',selected);
      surface.setAttribute('aria-valuetext',summary(selected));
      var tipWidth=Math.min(252,Math.max(205,width-28));
      tip.style.width=tipWidth+'px';
      var tipX=x+20;
      if(tipX+tipWidth>width-8)tipX=x-tipWidth-20;
      tip.style.left=Math.max(8,Math.min(width-tipWidth-8,tipX))+'px';
      tip.style.top='18px';
      hint.textContent=pinned?'Pinned · '+dateLabel(d.date)+' · Esc to release':dateLabel(d.date)+' · '+fmt(d.users)+' active · '+fmt(d.newUsers || 0)+' new';
      setOpen(true);
    }
    function indexAt(clientX){
      var bounds=chart.getBoundingClientRect();
      var localX=(clientX-bounds.left)*width/bounds.width;
      return Math.max(0,Math.min(days.length-1,Math.round((localX-layout.left)/layout.plotW*(days.length-1))));
    }
    function draw(force){
      var nextWidth=Math.max(260,Math.round(stage.getBoundingClientRect().width));
      if(!force && width===nextWidth)return;
      width=nextWidth;
      var height=width<480?268:312,left=32,right=14,top=14,bottom=40,floor=height-bottom;
      var peakValue=Math.max.apply(null,days.map(function(d){return Math.max(visible[0]?d.users:0,visible[1]?(d.newUsers || 0):0);}));
      var step=Math.max(1,Math.ceil(peakValue/4)),maximum=step*4;
      layout={left:left,right:right,floor:floor,plotW:width-left-right};
      layout.x=function(i){return left+layout.plotW*i/Math.max(1,days.length-1);};
      layout.y=function(v){return floor-(floor-top)*v/maximum;};
      chart.replaceChildren();chart.setAttribute('viewBox','0 0 '+width+' '+height);
      chart.style.height=height+'px';
      var defs=add(chart,svg('defs',{})),gradient=add(defs,svg('linearGradient',{id:'activity-fill',x1:0,y1:0,x2:0,y2:1}));
      add(gradient,svg('stop',{offset:'0%','stop-color':emerald,'stop-opacity':'.24'}));
      add(gradient,svg('stop',{offset:'100%','stop-color':emerald,'stop-opacity':'.005'}));
      for(var n=0;n<=4;n++){
        var y=layout.y(n*step);
        add(chart,svg('line',{x1:left,y1:y,x2:width-right,y2:y,class:'chart-grid'}));
        add(chart,svg('text',{x:left-12,y:y+4,'text-anchor':'end',class:'axis-label'},fmt(n*step)));
      }
      xTicks=[];
      var ticks=width<480?3:6,interval=Math.max(1,Math.ceil((days.length-1)/ticks));
      days.forEach(function(d,i){
        if(i%interval!==0 && i!==days.length-1)return;
        if(i!==days.length-1 && days.length-1-i<interval/2)return;
        var tick=add(chart,svg('text',{x:layout.x(i),y:height-14,'text-anchor':i===0?'start':i===days.length-1?'end':'middle',class:'axis-label'},dateLabel(d.date)));
        xTicks.push({node:tick,x:layout.x(i)});
      });
      fields.forEach(function(field,i){
        if(!visible[i])return;
        var path=days.map(function(d,index){return (index?'L':'M')+layout.x(index).toFixed(2)+' '+layout.y(d[field] || 0).toFixed(2);}).join(' ');
        if(i===0){
          add(chart,svg('path',{d:path+' L'+layout.x(days.length-1)+' '+floor+' L'+left+' '+floor+' Z',fill:'url(#activity-fill)',class:'chart-area'}));
          add(chart,svg('path',{d:path,class:'chart-line chart-glow','aria-hidden':'true'}));
        }
        add(chart,svg('path',{d:path,class:'chart-line'+(i?' chart-new-line':'')}));
        var last=days[days.length-1];
        add(chart,svg('circle',{cx:layout.x(days.length-1),cy:layout.y(last[field] || 0),r:3,fill:colors[i]}));
      });
      crosshair=add(chart,svg('g',{visibility:'hidden','pointer-events':'none',class:'chart-focus'}));
      add(crosshair,svg('line',{x1:0,x2:0,y1:top,y2:floor,class:'chart-crosshair'}));
      markers=fields.map(function(_,i){return add(crosshair,svg('circle',{cx:0,cy:0,r:5,fill:colors[i],class:'chart-focus-dot'}));});
      bottomTag=add(chart,svg('g',{visibility:'hidden','pointer-events':'none'}));
      add(bottomTag,svg('rect',{x:-38,y:-13,width:76,height:24,rx:6,class:'chart-date-tag'}));
      dateTag=add(bottomTag,svg('text',{x:0,y:3,'text-anchor':'middle',class:'chart-date-label'}));
      surface=add(chart,svg('rect',{x:left,y:top,width:layout.plotW,height:floor-top,fill:'transparent',class:'chart-surface',tabindex:0,role:'slider','aria-label':'Explore daily activity','aria-orientation':'horizontal','aria-valuemin':0,'aria-valuemax':days.length-1,'aria-valuenow':selected,'aria-valuetext':summary(selected),'aria-describedby':'daily-chart-tooltip'}));
      surface.onpointermove=function(e){
        if(pinned)return;
        pendingX=e.clientX;
        if(!frame)frame=requestAnimationFrame(function(){frame=0;inspect(indexAt(pendingX));});
      };
      surface.onpointerleave=function(){if(frame){cancelAnimationFrame(frame);frame=0;}if(!pinned)setOpen(false);};
      surface.onpointercancel=function(){if(!pinned)setOpen(false);};
      surface.onclick=function(e){
        if(frame){cancelAnimationFrame(frame);frame=0;}
        var next=indexAt(e.clientX);
        pinned=!(pinned && next===selected);inspect(next);
      };
      surface.onfocus=function(){inspect(selected);};
      surface.onblur=function(){if(!pinned)setOpen(false);};
      surface.onkeydown=function(e){
        if(e.key==='Escape'){e.preventDefault();pinned=false;setOpen(false);return;}
        var next=selected;
        if(e.key==='ArrowRight')next++;
        else if(e.key==='ArrowLeft')next--;
        else if(e.key==='Home')next=0;
        else if(e.key==='End')next=days.length-1;
        else if(e.key==='Enter' || e.key===' '){pinned=!pinned;}
        else return;
        e.preventDefault();inspect(next);
      };
      keys.forEach(function(key,i){key.setAttribute('aria-pressed',String(visible[i]));key.disabled=visible[i]&&!visible[1-i];});
      if(isOpen)inspect(selected);
    }
    draw(true);
    if(typeof ResizeObserver==='function'){observer=new ResizeObserver(function(){draw(false);});observer.observe(stage);}
    chartCleanup=function(){if(observer)observer.disconnect();if(frame)cancelAnimationFrame(frame);};
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
    if(chartCleanup){chartCleanup();chartCleanup=null;}
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
    add(activity,h('h2','section-title','Daily activity'));add(activity,h('p','sub','Active and new users per day · Last '+range+' days'));lineChart(activity,data.daily);
    var a=add(charts,h('section','panel audience'));add(a,h('h2','section-title','Audience'));add(a,h('p','sub','Unique users · Last '+range+' days'));audience(a,s);
    countries(add(wrap,h('section','panel countries')),data);
    var footer=add(wrap,h('footer')),note=add(footer,h('div','foot-note'));
    add(note,h('div','','Last updated: '+new Date(data.generatedAt).toLocaleString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'UTC'})+' UTC'));
    add(note,h('div','','Daily analytics snapshot. Data may be up to 24 hours old.'));
    var details=add(footer,h('details','methodology'));add(details,h('summary','','About these numbers'));
    add(details,h('p','','Only identified ChatGPT tool activity from verified OpenAI networks is counted. This signal cannot prove that every call was human initiated. Known bots and anonymous traffic are excluded.'));
    add(details,h('p','','Each user counts once per UTC day, with up to '+data.trackingLimit+' users recorded daily and '+data.retentionDays+' days of history. New users and First seen mean first observed within retained history, so an older user outside the retention window may appear new.'));
    add(details,h('p','','Countries use approximate ChatGPT location metadata. Missing and historical locations remain Unknown. Each user appears under their latest recorded known country in the selected period.'));
  }
  load();
})();
`;
