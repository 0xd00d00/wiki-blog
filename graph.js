(function () {
  'use strict';
  var svg = document.getElementById('knowledgeGraph');
  if (!svg) return;
  var $ = function (id) { return document.getElementById(id); };
  var NS = 'http://www.w3.org/2000/svg';
  var base = new URL('./', document.querySelector('script[data-base]').src);
  var data, selected = null, zoom = 1, pan = {x: 0, y: 0}, points = new Map(), drag = null;
  var activeGroup = null, animation = null, alpha = 0, hovered = null, renderedNodes = [], renderedLinks = [];
  var reduced = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : {matches:false};
  var settings = {repel:900, distance:55, link:.03, center:.006};
  function syncPositions() {
    renderedNodes.forEach(function(r){var p=points.get(r.id);r.el.setAttribute('transform','translate('+p.x+' '+p.y+')')});
    renderedLinks.forEach(function(r){var a=points.get(r.source),b=points.get(r.target);r.el.setAttribute('x1',a.x);r.el.setAttribute('y1',a.y);r.el.setAttribute('x2',b.x);r.el.setAttribute('y2',b.y)});
  }
  function stop() {if(animation!==null)cancelAnimationFrame(animation);animation=null}
  function settle(steps) {
    if(!data||!window.WikiGraphPhysics)return;
    var nodes=data.nodes.map(function(n){return points.get(n.id)});
    for(var i=0;i<steps;i++)WikiGraphPhysics.step(nodes,data.links,settings,Math.max(.1,1-i/steps),drag&&drag.id);
    syncPositions();
  }
  function wake() {
    if(!data)return;
    alpha=1;stop();
    if(reduced.matches||!$('graphMotion').checked){settle(160);return}
    function frame(){
      animation=null;
      if(document.hidden||$('pane-links').hidden)return;
      WikiGraphPhysics.step(data.nodes.map(function(n){return points.get(n.id)}),data.links,settings,alpha,drag&&drag.id);
      syncPositions();alpha*=.976;
      if(alpha>.025||drag&&drag.id)animation=requestAnimationFrame(frame);
    }
    animation=requestAnimationFrame(frame);
  }
  function highlight() {
    var focus=selected, near=new Set([focus]);
    var chosen=data&&data.nodes.find(function(n){return n.id===focus});svg.style.setProperty('--graph-focus',chosen?groupColor(chosen.group):'var(--accent)');
    if(data)data.links.forEach(function(l){if(l.source===focus)near.add(l.target);if(l.target===focus)near.add(l.source)});
    renderedNodes.forEach(function(r){r.el.style.opacity=focus&&!near.has(r.id)?.25:1;r.el.classList.toggle('highlighted',r.id===focus);r.el.classList.toggle('hovered',r.id===hovered);r.el.classList.toggle('connected',!!focus&&near.has(r.id))});
    renderedLinks.forEach(function(r){var active=focus&&(r.source===focus||r.target===focus);r.el.classList.toggle('active',!!active);r.el.style.opacity=focus&&!active?.16:1});
  }
  var pointers=new Map(),pinch=null;
  var colors = ['#3978CC', '#9362CE', '#208571', '#BB7931', '#BD527B'];
  function groupColor(id){return id<colors.length?colors[id]:'hsl('+((id*137.508)%360)+' 48% 52%)'}
  function node(tag, attrs, text) {
    var el = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function transform() { $('graphView').setAttribute('transform', 'translate(' + pan.x + ' ' + pan.y + ') scale(' + zoom + ')'); svg.classList.toggle('graph-zoomed',zoom>=1.5); }
  function reset() { zoom = 1; pan = {x: 0, y: 0}; if(data){position();syncPositions();wake()} transform(); }
  function changeZoom(factor) {
    var next = Math.max(.45, Math.min(4, zoom * factor));
    pan.x = 450 - (450 - pan.x) * next / zoom;
    pan.y = 300 - (300 - pan.y) * next / zoom;
    zoom = next; transform();
  }
  function visible() {
    var q = $('graphQuery').value.trim().toLocaleLowerCase(), tag = $('graphTag').value;
    var neighbours = new Set([selected]);
    data.links.forEach(function (l) { if(l.source === selected) neighbours.add(l.target); if(l.target === selected) neighbours.add(l.source); });
    return data.nodes.filter(function(n) {
      return (activeGroup===null || n.group===activeGroup) && (!q || n.title.toLocaleLowerCase().includes(q)) && (!tag || n.tags.includes(tag)) && (!$('graphLocal').checked || !selected || neighbours.has(n.id));
    });
  }
  function select(id) { selected = id; detail(); paint(); }
  function detail() {
    var box = $('graphDetail'); box.replaceChildren(); box.hidden = !selected;
    if (!selected) return;
    var n = data.nodes.find(function(n) {return n.id === selected;});
    var title = document.createElement('h2'); title.textContent = n.title; box.appendChild(title);
    var p = document.createElement('p'); p.textContent = n.description || ''; box.appendChild(p);
    var a = document.createElement('a'); a.href = new URL(n.url, base); a.textContent = '문서 열기 →'; box.appendChild(a);
    var neighbours = new Set();
    data.links.forEach(function(l) {if(l.source===selected) neighbours.add(l.target); if(l.target===selected) neighbours.add(l.source);});
    var heading = document.createElement('p'); heading.textContent = '연결된 문서 ' + neighbours.size + '개'; box.appendChild(heading);
    var list = document.createElement('ul');
    data.nodes.filter(function(n) {return neighbours.has(n.id);}).forEach(function(n) {
      var li=document.createElement('li'), b=document.createElement('button'); b.type='button'; b.textContent=n.title;
      b.addEventListener('click',function(){select(n.id)}); li.appendChild(b); list.appendChild(li);
    });
    box.appendChild(list);
  }
  function paint() {
    var view = $('graphView'); view.replaceChildren(); renderedNodes=[];renderedLinks=[];
    var nodes = visible(), ids = new Set(nodes.map(function(n){return n.id;}));
    var links = data.links.filter(function(l){return ids.has(l.source)&&ids.has(l.target);});
    var neighbours = new Set([selected]);
    links.forEach(function(l) {if(l.source===selected)neighbours.add(l.target);if(l.target===selected)neighbours.add(l.source);});
    links.forEach(function(l) {
      var a=points.get(l.source), b=points.get(l.target), active=selected&&(l.source===selected||l.target===selected);
      var edge=node('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:'graph-edge'+(active?' active':''),opacity:selected&&!active?.22:1});view.appendChild(edge);renderedLinks.push({el:edge,source:l.source,target:l.target});
    });
    nodes.forEach(function(n) {
      var p=points.get(n.id), group=node('g',{transform:'translate('+p.x+' '+p.y+')','data-id':n.id,class:'graph-node'+(selected===n.id?' selected':''),role:'button',tabindex:'0','aria-label':n.title,'aria-pressed':selected===n.id,opacity:selected&&!neighbours.has(n.id)?.35:1});
      var degree=links.filter(function(l){return l.source===n.id||l.target===n.id;}).length;
      group.appendChild(node('circle',{r:Math.min(23,4+Math.sqrt(degree)*2.8),fill:'var(--ink2)'}));
      group.appendChild(node('circle',{r:22,fill:'transparent',class:'graph-hit'}));
      group.appendChild(node('title',{},n.title));
      group.appendChild(node('text',{x:0,y:29,'text-anchor':'middle',class:'graph-label'},n.title.length>15?n.title.slice(0,15)+'…':n.title));
      group.addEventListener('click',function(){if(!svg.dataset.moved)select(n.id)});
      group.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();select(n.id);var current=svg.querySelector('[data-id="'+n.id+'"]');if(current)current.focus()}});
      group.addEventListener('pointerenter',function(){if(!drag){hovered=n.id;highlight()}});
      group.addEventListener('pointerleave',function(){hovered=null;highlight()});
      group.addEventListener('dblclick',function(){location.href=new URL(n.url,base)});
      view.appendChild(group);renderedNodes.push({el:group,id:n.id});
    });
    $('graphSummary').textContent = (data.demo?'임시 테스트 · ':'') + nodes.length + '개 문서 · ' + links.length + '개 연결' + (!data.links.length?' · 문서 간 링크가 아직 없습니다':'');
    var list=$('graphDocuments'); list.replaceChildren();
    nodes.forEach(function(n) {var li=document.createElement('li'),a=document.createElement('a');a.href=new URL(n.url,base);a.textContent=n.title;li.appendChild(a);list.appendChild(li)});
    transform();highlight();
  }
  function position() {
    data.nodes.forEach(function(n,i){
      var angle=i*2.399963, radius=data.nodes.length===1?0:Math.sqrt((i+.5)/data.nodes.length);
      points.set(n.id,{id:n.id,group:n.group,x:450+355*radius*Math.cos(angle),y:300+225*radius*Math.sin(angle),cx:450,cy:300,vx:0,vy:0});
    });
  }

  function coord(e) {var p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
  svg.addEventListener('pointerdown',function(e){
    if(e.button!==0)return;
    pointers.set(e.pointerId,coord(e));
    if(pointers.size>=2){
      var pair=Array.from(pointers.values()).slice(0,2),mid={x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2};
      pinch={distance:Math.max(1,Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y)),zoom:zoom,anchor:{x:(mid.x-pan.x)/zoom,y:(mid.y-pan.y)/zoom}};
      drag=null;svg.dataset.moved='true';svg.classList.add('interacting');svg.setPointerCapture(e.pointerId);return;
    }
    var n=e.target.closest('[data-id]');
    drag={id:n?n.dataset.id:null,start:coord(e),pan:{x:pan.x,y:pan.y},point:n?Object.assign({},points.get(n.dataset.id)):null,moved:false};
    delete svg.dataset.moved; svg.classList.add('interacting'); svg.setPointerCapture(e.pointerId);if(drag.id&&$('graphMotion').checked&&!reduced.matches)wake();
  });
  svg.addEventListener('pointermove',function(e){
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,coord(e));
    if(pinch&&pointers.size>=2){
      var pair=Array.from(pointers.values()).slice(0,2),mid={x:(pair[0].x+pair[1].x)/2,y:(pair[0].y+pair[1].y)/2};
      zoom=Math.max(.45,Math.min(4,pinch.zoom*Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y)/pinch.distance));
      pan.x=mid.x-pinch.anchor.x*zoom;pan.y=mid.y-pinch.anchor.y*zoom;transform();return;
    }
    if(!drag)return;var p=coord(e),dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    if(Math.abs(dx)+Math.abs(dy)<3&&!drag.moved)return;
    drag.moved=true;svg.dataset.moved='true';
    if(drag.id){var point=points.get(drag.id);point.x=drag.point.x+dx/zoom;point.y=drag.point.y+dy/zoom;point.vx=0;point.vy=0;syncPositions()}
    else{pan.x=drag.pan.x+dx;pan.y=drag.pan.y+dy;transform()}
  });
  svg.addEventListener('pointerup',function(e){
    pointers.delete(e.pointerId);
    if(pinch){if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);if(!pointers.size){pinch=null;svg.classList.remove('interacting')}return;}
    if(drag&&!drag.moved){hovered=null;select(drag.id)};
    if(svg.hasPointerCapture(e.pointerId))svg.releasePointerCapture(e.pointerId);
    var moved=drag&&drag.moved&&drag.id;drag=null;svg.classList.remove('interacting');if(moved&&$('graphMotion').checked&&!reduced.matches)wake();
  });
  svg.addEventListener('pointercancel',function(){drag=null;pinch=null;pointers.clear();svg.classList.remove('interacting')});
  svg.addEventListener('wheel',function(e){e.preventDefault();changeZoom(e.deltaY<0?1.12:1/1.12)},{passive:false});
  $('graphZoomIn').addEventListener('click',function(){changeZoom(1.25)});
  $('graphZoomOut').addEventListener('click',function(){changeZoom(.8)});
  $('graphReset').addEventListener('click',reset);
  ['graphQuery','graphTag','graphLocal'].forEach(function(id){$(id).addEventListener('input',function(){if(data)paint()})});
  svg.addEventListener('keydown',function(e){if(e.key==='Escape'){hovered=null;select(null)}});
  $('graphMotion').checked=!reduced.matches;
  $('graphMotion').addEventListener('change',function(){if($('graphMotion').checked)wake();else stop()});
  ['graphDistance','graphRepel','graphLink'].forEach(function(id){$(id).addEventListener('input',function(){settings.distance=+$('graphDistance').value;settings.repel=+$('graphRepel').value;settings.link=+$('graphLink').value/100;wake()})});
  document.addEventListener('visibilitychange',function(){if(document.hidden)stop();else if(alpha>.025)wake()});
  new MutationObserver(function(){if($('pane-links').hidden)stop();else if(alpha>.025)wake()}).observe($('pane-links'),{attributes:true,attributeFilter:['hidden']});
  if(reduced.addEventListener)reduced.addEventListener('change',function(){if(reduced.matches){$('graphMotion').checked=false;stop()}});
  window.addEventListener('pagehide',stop);
  fetch(new URL('graph-data.json',base)).then(function(r){if(!r.ok)throw new Error();return r.json()}).then(function(d){
    data=d; position();
    var tags=new Set();data.nodes.forEach(function(n){n.tags.forEach(function(t){tags.add(t)})});
    Array.from(tags).sort().forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent='#'+t;$('graphTag').appendChild(o)});
    var legend=document.createElement('div');legend.className='graph-legend';
    var counts=new Map();data.nodes.forEach(function(n){counts.set(n.group,(counts.get(n.group)||0)+1)});
    var groups=Array.from(counts.keys()).map(function(id){return{id:id,name:(data.groups||[])[id]||'기타',count:counts.get(id)}}).sort(function(a,b){return b.count-a.count||a.id-b.id});
    function groupButton(g){
      var item=document.createElement('button'),dot=document.createElement('i');item.type='button';item.setAttribute('aria-pressed','false');item.dataset.group=g.id;
      dot.style.background=groupColor(g.id);item.appendChild(dot);item.appendChild(document.createTextNode(g.name+' '+g.count));
      item.addEventListener('click',function(){activeGroup=activeGroup===g.id?null:g.id;legend.querySelectorAll('button[data-group]').forEach(function(b){b.setAttribute('aria-pressed',String(activeGroup===+b.dataset.group))});paint()});return item;
    }
    groups.slice(0,5).forEach(function(g){legend.appendChild(groupButton(g))});
    if(groups.length>5){
      var more=document.createElement('details');more.className='graph-more-groups';
      var summary=document.createElement('summary');summary.textContent='그룹 더 보기 ('+(groups.length-5)+'개)';more.appendChild(summary);
      var search=document.createElement('input');search.type='search';search.placeholder='그룹 찾기';search.setAttribute('aria-label','추가 그룹 검색');more.appendChild(search);
      var list=document.createElement('div');list.className='graph-group-list';
      groups.slice(5).forEach(function(g){var b=groupButton(g);b.dataset.name=g.name;list.appendChild(b)});
      search.addEventListener('input',function(){list.querySelectorAll('button').forEach(function(b){b.hidden=!b.dataset.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase())})});more.appendChild(list);legend.appendChild(more);
    }
    var groupPanel=document.createElement('details');groupPanel.className='graph-group-panel';
    var groupTitle=document.createElement('summary');groupTitle.textContent='그룹으로 찾기 ('+groups.length+'개)';groupPanel.appendChild(groupTitle);groupPanel.appendChild(legend);
    $('graphStage').before(groupPanel);paint();wake();
  }).catch(function(){$('graphSummary').textContent='그래프를 불러오지 못했습니다. 폴더 구조 탭을 이용해 주세요.'});
})();
