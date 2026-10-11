(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var script = document.currentScript || document.querySelector("script[data-base]");
  var BASE = script ? script.getAttribute("data-base") : "/";
  var SITE = (function () {
    var l = document.querySelector('link[rel="stylesheet"][href*="style.css"]');
    if (l) return new URL("./", l.href).href;
    return BASE;
  })();
  var root = document.documentElement;

  /* ---------- 테마 ---------- */
  var themeEl = $("theme");
  function setTheme(t) {
    root.setAttribute("data-theme", t);
    if (themeEl) {
      themeEl.dataset.current = t;
      themeEl.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x.dataset.t === t); });
    }
    var l = $("gl-light"), d = $("gl-dark");
    if (l) l.media = t === "light" ? "all" : "not all";
    if (d) d.media = t === "dark" ? "all" : "not all";
    try { localStorage.setItem("theme", t); } catch (e) {}
  }
  if (themeEl) {
    var cur = root.getAttribute("data-theme") || "dark";
    themeEl.dataset.current = cur;
    themeEl.querySelectorAll("button").forEach(function (b) {
      b.setAttribute("aria-pressed", b.dataset.t === cur);
      b.addEventListener("click", function () { setTheme(b.dataset.t); });
    });
  }

  /* ---------- 모바일(620px 이하): 목록 10개만 먼저, 나머지는 "더 보기" ---------- */
  (function () {
    var box = $("docList"), btn = $("moreDocs");
    if (!box || !btn) return;
    var LIMIT = 10;
    var items = box.querySelectorAll("li");
    if (items.length <= LIMIT) return;
    var mq = matchMedia("(max-width:620px)");
    function sync() {
      var fold = mq.matches && !box.classList.contains("expanded");
      root.classList.toggle("js-fold", mq.matches);
      btn.hidden = !(mq.matches && !box.classList.contains("expanded"));
      btn.textContent = "더 보기 (" + (items.length - LIMIT) + "개)";
    }
    btn.addEventListener("click", function () {
      box.classList.add("expanded");
      sync();
      if (items[LIMIT]) { var a = items[LIMIT].querySelector("a"); if (a) a.focus({ preventScroll: true }); }
    });
    mq.addEventListener("change", sync);
    sync();
  })();

  /* ---------- 목록 위치 기억 / ← 목록 ---------- */
  var isList = !!document.querySelector(".docs");
  if (isList) {
    try {
      sessionStorage.setItem("listUrl", location.href);
      var y = +sessionStorage.getItem("listY:" + location.href) || 0;
      if (y && history.scrollRestoration) requestAnimationFrame(function () { scrollTo(0, y); });
      addEventListener("pagehide", function () { sessionStorage.setItem("listY:" + location.href, String(scrollY)); });
    } catch (e) {}
  }
  var back = $("back");
  if (back) {
    back.addEventListener("click", function (e) {
      var url = null;
      try { url = sessionStorage.getItem("listUrl"); } catch (err) {}
      if (url && history.length > 1 && document.referrer && document.referrer === url) {
        e.preventDefault();
        history.back();
      } else if (url) {
        e.preventDefault();
        location.href = url;
      }
    });
  }

  /* ---------- 태그 페이지 정렬 ---------- */
  var byCount = $("tagsByCount"), byName = $("tagsByName");
  if (byCount && byName) {
    document.querySelectorAll(".tagsort button").forEach(function (b) {
      b.addEventListener("click", function () {
        var name = b.dataset.sort === "name";
        byCount.hidden = name;
        byName.hidden = !name;
        document.querySelectorAll(".tagsort button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      });
    });
  }

  /* ---------- 목차 ---------- */
  var tocEl = $("toc");
  if (tocEl) {
    var links = Array.prototype.slice.call(tocEl.querySelectorAll("a[data-id]"));
    var heads = links.map(function (a) { return document.getElementById(a.dataset.id); }).filter(Boolean);
    $("tocN").textContent = links.length + "개 절";
    var wide = matchMedia("(min-width:1280px)");
    var sync = function () { tocEl.open = wide.matches; };
    wide.addEventListener("change", sync);
    sync();
    tocEl.querySelector("summary").addEventListener("click", function (e) { if (wide.matches) e.preventDefault(); });
    var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        var h = document.getElementById(a.dataset.id);
        if (!h) return;
        e.preventDefault();
        h.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", "#" + a.dataset.id);
      });
    });
    var nav = $("tocList"), body = $("docBody"), TOP = 88, lastC = -2;
    var contentEnd = function () {
      var kids = Array.prototype.slice.call(body.children).filter(function (el) {
        return el !== tocEl && !el.classList.contains("backlinks");
      });
      var last = kids[kids.length - 1];
      return last ? last.getBoundingClientRect().bottom : Infinity;
    };
    var place = function () {
      if (!wide.matches) { tocEl.style.transform = ""; return; }
      tocEl.style.transform = "";
      var over = TOP + tocEl.offsetHeight - contentEnd();
      if (over > 0) tocEl.style.transform = "translateY(" + (-over) + "px)";
    };
    var spy = function () {
      var c = -1;
      heads.forEach(function (h, i) { if (h.getBoundingClientRect().top <= 90) c = i; });
      if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2 && heads.length) c = heads.length - 1;
      if (c !== lastC) {
        lastC = c;
        links.forEach(function (a, i) { a.classList.toggle("on", i === c); });
        if (c >= 0 && wide.matches) {
          var nr = nav.getBoundingClientRect(), ar = links[c].getBoundingClientRect();
          if (ar.top < nr.top + 8 || ar.bottom > nr.bottom - 8) nav.scrollTop += ar.top - nr.top - nr.height / 2 + ar.height / 2;
        }
      }
      place();
    };
    addEventListener("scroll", spy, { passive: true });
    addEventListener("resize", spy);
    addEventListener("load", spy);
    wide.addEventListener("change", spy);
    spy();
  }

  /* ---------- 본문 외부 링크 표시 ---------- */
  document.querySelectorAll("#docBody a[href^='http']").forEach(function (a) {
    if (a.hostname !== location.hostname) a.classList.add("ext");
  });

  /* ---------- 검색 ---------- */
  var sdlg = $("sdlg"), sq = $("sq"), sres = $("sres"), scnt = $("scnt"), schips = $("schips");
  if (!sdlg) return;
  var loadError = null;
  var docs = null, loading = null, sel = 0, hits = [], sTag = null, sLast = null;
  var nf = function (t) { return (t || "").normalize("NFC").toLowerCase(); };
  var esc = function (t) { return t.replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  function mark(t, q) {
    t = (t || "").normalize("NFC");
    if (!q) return esc(t);
    var i = nf(t).indexOf(nf(q));
    if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + "<mark>" + esc(t.slice(i, i + q.length)) + "</mark>" + esc(t.slice(i + q.length));
  }
  function load() {
    if (docs) return Promise.resolve();
    if (!loading) {
      loading = fetch(SITE + "wiki-index.json", { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      }).then(function (j) {
        docs = j.map(function (d) {
          d.title = d.title.normalize("NFC");
          d.description = (d.description || "").normalize("NFC");
          d.tags = (d.tags || []).map(function (t) { return t.normalize("NFC"); });
          return d;
        });
      }).catch(function (e) { docs = []; loadError = String(e && e.message || e); });
    }
    return loading;
  }
  function score(d, q) {
    var ql = nf(q), t = nf(d.title), de = nf(d.description), tags = d.tags.map(nf);
    var bare = ql.replace(/^#/, "");
    var sc = 0, where = [];
    if (t === ql) sc += 100;
    if (t.indexOf(ql) === 0) sc += 60;
    if (t.indexOf(ql) >= 0) { sc += 40; where.push("제목"); }
    if (bare && tags.some(function (x) { return x === bare; })) { sc += 35; where.push("태그"); }
    else if (bare && tags.some(function (x) { return x.indexOf(bare) >= 0; })) { sc += 15; where.push("태그"); }
    if (de.indexOf(ql) >= 0) { sc += 12; where.push("설명"); }
    return { sc: sc, where: where };
  }
  function topTags() {
    var c = {};
    docs.forEach(function (d) { d.tags.forEach(function (t) { c[t] = (c[t] || 0) + 1; }); });
    return Object.keys(c).sort(function (a, b) { return c[b] - c[a] || a.localeCompare(b, "ko"); }).slice(0, 6);
  }
  function run() {
    if (!docs) return;
    var q = sq.value.trim().normalize("NFC");
    var list = sTag ? docs.filter(function (d) { return d.tags.indexOf(sTag) >= 0; }) : docs;
    hits = [];
    if (q) {
      list.forEach(function (d) { var r = score(d, q); if (r.sc > 0) hits.push({ d: d, sc: r.sc, where: r.where }); });
      hits.sort(function (a, b) { return b.sc - a.sc || (b.d.updated < a.d.updated ? -1 : b.d.updated > a.d.updated ? 1 : 0); });
    } else {
      hits = list.slice(0, 6).map(function (d) { return { d: d, sc: 0, where: [] }; });
    }
    sel = 0;
    paint(q);
  }
  function paint(q) {
    schips.innerHTML = "";
    topTags().forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.textContent = "#" + t;
      b.setAttribute("aria-pressed", sTag === t);
      b.addEventListener("click", function () { sTag = sTag === t ? null : t; run(); sq.focus(); });
      schips.appendChild(b);
    });
    sres.innerHTML = "";
    if (loadError) {
      sres.innerHTML = '<div class="sempty"><b>검색 색인을 불러오지 못했습니다</b>' + esc(loadError) + " · " + esc(SITE + "wiki-index.json") + "</div>";
      sres.style.display = "block"; scnt.textContent = ""; return;
    }
    if (!docs.length) {
      sres.innerHTML = '<div class="sempty"><b>검색할 문서가 없습니다</b>공개(public : true)된 문서가 아직 없습니다</div>';
      sres.style.display = "block"; scnt.textContent = ""; return;
    }
    if (q && !hits.length) {
      sres.innerHTML = '<div class="sempty"><b>"' + esc(q) + '"에 맞는 문서가 없습니다</b>철자를 확인하거나 더 짧은 단어로 찾아보세요' + (sTag ? " (지금 #" + esc(sTag) + " 안에서만 찾는 중)" : "") + "</div>";
      sres.style.display = "block"; scnt.textContent = "0건"; return;
    }
    sres.style.display = "";
    var head = document.createElement("div"); head.className = "sgrp"; head.textContent = q ? "검색 결과" : "최근 수정한 문서";
    sres.appendChild(head);
    hits.slice(0, 8).forEach(function (h, i) {
      var el = document.createElement("div");
      el.className = "sitem"; el.id = "sr" + i; el.setAttribute("role", "option"); el.setAttribute("aria-selected", i === sel);
      el.innerHTML = '<div class="ic" aria-hidden="true">' + esc(h.d.icon) + '</div><div><div class="tt">' + mark(h.d.title, q) + '</div><div class="sn">' + mark(h.d.description, q) + "  " + h.d.tags.map(function (t) { return "#" + esc(t); }).join(" ") + '</div></div><div class="mt">' + (h.where.length ? "<b>" + h.where.join("·") + "</b>" : "") + h.d.updated.replace(/-/g, ".") + "</div>";
      el.addEventListener("mousemove", function () { if (sel !== i) { sel = i; markSel(); } });
      el.addEventListener("click", function () { open(i); });
      sres.appendChild(el);
    });
    scnt.textContent = q ? hits.length + "건" + (hits.length > 8 ? " 중 8건 표시" : "") : "";
    sq.setAttribute("aria-activedescendant", "sr" + sel);
  }
  function markSel() {
    sres.querySelectorAll(".sitem").forEach(function (e, i) { e.setAttribute("aria-selected", i === sel); });
    var c = sres.querySelector('.sitem[aria-selected="true"]');
    if (c) c.scrollIntoView({ block: "nearest" });
    sq.setAttribute("aria-activedescendant", "sr" + sel);
  }
  function openSearch() {
    sLast = document.activeElement;
    if (!sdlg.open) sdlg.showModal();
    sq.select();
    load().then(run);
  }
  function closeSearch() { if (sdlg.open) sdlg.close(); }
  function open(i) {
    var h = hits[i]; if (!h) return;
    closeSearch();
    location.href = SITE + h.d.url;
  }
  sdlg.addEventListener("close", function () { if (sLast && sLast.focus) sLast.focus(); });
  sdlg.addEventListener("click", function (e) { if (e.target === sdlg) closeSearch(); });
  $("sclose").addEventListener("click", closeSearch);
  $("searchBtn").addEventListener("click", openSearch);
  sq.addEventListener("input", run);
  sq.addEventListener("keydown", function (e) {
    var n = Math.min(hits.length, 8);
    if (e.key === "ArrowDown") { e.preventDefault(); if (n) { sel = (sel + 1) % n; markSel(); } }
    else if (e.key === "ArrowUp") { e.preventDefault(); if (n) { sel = (sel - 1 + n) % n; markSel(); } }
    else if (e.key === "Enter") { e.preventDefault(); open(sel); }
    else if (e.key === "Escape" && sq.value) { e.preventDefault(); e.stopPropagation(); sq.value = ""; run(); }
  });
  addEventListener("keydown", function (e) {
    if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var t = e.target, typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (!typing && !sdlg.open) { e.preventDefault(); openSearch(); }
    }
  });
})();
(function(){
  var tabs=document.querySelectorAll(".tabs button");
  if(!tabs.length)return;
  function show(name){
    tabs.forEach(function(b){b.setAttribute("aria-selected",b.dataset.pane===name)});
    document.querySelectorAll(".pane").forEach(function(p){p.hidden=p.id!=="pane-"+name});
    try{sessionStorage.setItem("mapTab",name)}catch(e){}
  }
  tabs.forEach(function(b){b.addEventListener("click",function(){show(b.dataset.pane)})});
  var want=(location.hash||"").replace("#","");
  var saved=null;try{saved=sessionStorage.getItem("mapTab")}catch(e){}
  show(want==="folders"||want==="links"?want:(saved||"links"));
})();
(function(){
  var imgs=document.querySelectorAll(".body img");
  if(!imgs.length||!window.HTMLDialogElement)return;
  var dlg=document.createElement("dialog");
  dlg.id="lbox";
  dlg.setAttribute("aria-label","이미지 확대");
  var big=document.createElement("img");
  dlg.appendChild(big);
  document.body.appendChild(dlg);
  function close(){dlg.close()}
  dlg.addEventListener("click",close);
  imgs.forEach(function(im){
    im.classList.add("zoomable");
    im.addEventListener("click",function(){
      big.src=im.currentSrc||im.src;
      big.alt=im.alt;
      dlg.showModal();
      dlg.scrollTop=0;dlg.scrollLeft=0;
    });
  });
})();
