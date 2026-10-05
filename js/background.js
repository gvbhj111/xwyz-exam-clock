/*
 * 背景轮播引擎（Background Carousel）
 * ------------------------------------------------------------------
 * 在 gallery.js 之后加载。
 *  - 统一管理 背景来源：内置图库 / 图床 / 必应每日 / 在线随机 / 本地图片 / 渐变 / 视频 / 自定义
 *  - 只操作 document.body（部分静态图床不允许自定义 HTTP 响应头，
 *    因此这里刻意不使用 Service Worker，保证 GitHub Pages、Netlify、
 *    Cloudflare Pages、Vercel、Gitee Pages 等纯静态托管开箱可用）
 *  - 兼容旧接口：bg() / getBg() / playCover() 仍然可用
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var doc = document;
  var STORE_KEY = "examclock.bg.v1";
  var BING_CACHE_KEY = "examclock.bing.v1";

  var BG = {
    data: null,          // 生效的配置
    plan: [],            // 拍平的候选背景
    current: null,       // 当前背景
    history: [],         // 最近使用
    timer: null,
    layer: null,
    video: null,
    ready: false,
    playing: false
  };

  /* ------------------------------------------------------------------ 工具 */
  function $(id) { return doc.getElementById(id); }

  function clamp(n, a, b) { n = Number(n); if (isNaN(n)) n = a; return Math.min(b, Math.max(a, n)); }

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function deepCopy(obj) { return JSON.parse(JSON.stringify(obj)); }

  function mergeSettings(base, override) {
    var out = deepCopy(base || {});
    Object.keys(override || {}).forEach(function (k) { out[k] = override[k]; });
    return out;
  }

  /* ------------------------------------------------------ localStorage */
  function readLocal() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); }
    catch (e) { return null; }
  }

  function writeLocal(cfg) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ settings: cfg.settings, items: cfg.items })); }
    catch (e) { /* 隐私模式忽略 */ }
  }

  /* --------------------------------------------------------- 生成候选池 */
  function planFromConfig(cfg) {
    var out = [];
    (cfg.items || []).forEach(function (item) {
      if (item.enabled === false) return;
      var weight = clamp(item.weight == null ? 1 : item.weight, 0, 99);
      if (!weight) return;
      var entries = sourcesOf(item);
      entries.forEach(function (e) { e.weight = weight; e.sourceId = item.id; out.push(e); });
    });
    return out;
  }

  /* 单个来源展开成若干候选条目 */
  function sourcesOf(item) {
    var list = [];
    var type = item.type;

    if (type === "gallery") {
      list = (item.list || []).map(function (x) {
        return { kind: "image", author: x.author || "佚名", name: x.name || "", vol: x.vol || item.name, url: x.url };
      });
      // 合并 gallery.js 内置图库：显式填了 volumes 的按卷筛选，
      // 另外自己带了 list 的来源（如"精选"）不再重复合并全量图库。
      var useGlobal = (item.volumes && item.volumes.length) || !(item.list && item.list.length);
      if (useGlobal && global.galleryFlated && global.galleryFlated.length) {
        var vols = item.volumes && item.volumes.length ? item.volumes : null;
        var pickList = vols
          ? global.galleryFlated.filter(function (g) { return vols.indexOf(g.vol) >= 0; })
          : global.galleryFlated;
        list = list.concat(pickList.map(function (g) {
          return { kind: "image", author: g.author, name: g.name, vol: g.vol, url: g.url };
        }));
      }
      return list;
    }

    if (type === "custom" || type === "static" || type === "local") {
      return (item.list || []).map(function (x) {
        return { kind: "image", author: x.author || "自定义", name: x.name || "", vol: item.name, url: x.url, local: type === "local" };
      });
    }

    if (type === "gradient" || type === "solid") {
      return (item.list || []).map(function (x) {
        return { kind: "css", author: x.author || "主题", name: x.name || "", vol: item.name, css: x.css };
      });
    }

    if (type === "video") {
      return (item.list || []).map(function (x) {
        return { kind: "video", author: x.author || "视频", name: x.name || "", vol: item.name, url: x.url, poster: x.poster || "" };
      });
    }

    if (type === "bing") {
      var cached = readBingCache(item);
      return cached.map(function (x) {
        return { kind: "image", author: "Bing", name: x.name || "", vol: item.name, url: x.url };
      });
    }

    if (type === "online") {
      // 在线随机图源：不需要预生成，占位多个名额提高命中率
      var n = clamp(item.slots || 6, 1, 20);
      var arr = [];
      for (var i = 0; i < n; i++) {
        arr.push({
          kind: "image-url",
          author: item.author || item.name,
          name: (item.topics && item.topics.length ? pick(item.topics) : "随机") + " #" + (i + 1),
          vol: item.name,
          api: item.api,
          suffix: item.suffix || "",
          topics: item.topics || null,
          cacheBust: true
        });
      }
      return arr;
    }

    return list;
  }

  /* ------------------------------------------------------------ 必应壁纸 */
  function readBingCache(item) {
    var out = [];
    try {
      var raw = JSON.parse(localStorage.getItem(BING_CACHE_KEY) || "null");
      if (raw && raw.base === item.base && Date.now() - raw.at < clamp(item.cacheMinutes || 180, 5, 1440) * 60000) {
        return raw.list;
      }
    } catch (e) { }
    return out;
  }

  function fetchBing(item) {
    if (!item.api || !global.fetch) return Promise.resolve([]);
    var cached = readBingCache(item);
    if (cached.length) return Promise.resolve(cached);
    var url = item.api + (item.api.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (json) {
        var imgs = (json && json.images) || [];
        var list = imgs.map(function (im) {
          return {
            author: "Bing",
            name: (im.title || "").slice(0, 40),
            vol: item.name,
            url: (im.url || "").indexOf("http") === 0 ? im.url : (item.base || "") + (im.url || ""),
            thumb: (item.base || "") + (im.urlbase || "") + "_400x240.jpg"
          };
        }).filter(function (x) { return x.url; });
        if (list.length) {
          try { localStorage.setItem(BING_CACHE_KEY, JSON.stringify({ at: Date.now(), base: item.base, list: list })); } catch (e) { }
        }
        return list;
      })
      .catch(function () { return []; });
  }

  /* --------------------------------------------------------- 渲染与切换 */
  function ensureLayer() {
    if (!BG.layer) {
      BG.layer = doc.createElement("div");
      BG.layer.id = "bgLayer";
      doc.body.insertBefore(BG.layer, doc.body.firstChild);
    }
    return BG.layer;
  }

  function ensureVideo() {
    if (!BG.video) {
      BG.video = doc.createElement("video");
      BG.video.id = "bgVideo";
      BG.video.muted = true;
      BG.video.loop = true;
      BG.video.playsInline = true;
      BG.video.setAttribute("muted", "");
      ensureLayer().appendChild(BG.video);
    }
    return BG.video;
  }

  function url(entry) {
    if (!entry) return "";
    if (entry.api) {
      var u = entry.api;
      if (entry.topics && entry.topics.length) u += encodeURIComponent(pick(entry.topics));
      else if (entry.kind === "image-url" && u.indexOf("seed") >= 0) u += Math.random().toString(36).slice(2, 10);
      u += entry.suffix || "";
      if (entry.cacheBust) u += (u.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now();
      return u;
    }
    return entry.url || "";
  }

  function preload(u) {
    return new Promise(function (resolve) {
      if (!u) return resolve(false);
      var img = new Image();
      var done = false;
      var fin = function (ok) { if (!done) { done = true; resolve(ok); } };
      img.onload = function () { fin(true); };
      img.onerror = function () { fin(false); };
      img.src = u;
      setTimeout(function () { fin(false); }, 12000);
    });
  }

  function applyEffects(entry) {
    var html = doc.documentElement;
    var st = BG.data.settings;
    var filters = { none: "", blur: "blur(6px)", gray: "grayscale(1)", warm: "sepia(.35) saturate(1.2)", cool: "hue-rotate(-12deg) saturate(1.1)", dark: "brightness(.75)" };
    html.style.setProperty("--bg-filter", filters[st.effect] || "");
    html.style.setProperty("--bg-focus", st.focus || "center center");
    html.style.setProperty("--bg-darken", clamp(st.darken == null ? 50 : st.darken, 0, 90) / 100);
    html.style.setProperty("--bg-transition", (st.transition === "none" ? 0 : clamp(st.transitionMs, 0, 6000)) + "ms");
    html.style.setProperty("--bg-kenburns", st.kenBurns ? "1" : "0");
    html.classList.toggle("kenburns-off", !st.kenBurns);
    if (entry && entry.kind === "video") html.setAttribute("data-bg-kind", "video");
    else html.removeAttribute("data-bg-kind");
  }

  function hideVideo() { if (BG.video) BG.video.style.display = "none"; }

  function renderImage(entry, u) {
    var layer = ensureLayer();
    var frame = doc.createElement("div");
    frame.className = "bgFrame";
    frame.style.backgroundImage = 'url("' + u.replace(/"/g, "%22") + '")';
    frame.style.backgroundPosition = BG.data.settings.focus || "center center";
    hideVideo();
    layer.appendChild(frame);
    // 强制重排后淡入
    void frame.offsetWidth;
    frame.classList.add("show");
    pruneFrames(layer);
  }

  function renderCss(entry) {
    var layer = ensureLayer();
    var frame = doc.createElement("div");
    frame.className = "bgFrame";
    frame.style.background = entry.css;
    frame.style.backgroundPosition = "center center";
    hideVideo();
    layer.appendChild(frame);
    void frame.offsetWidth;
    frame.classList.add("show");
    pruneFrames(layer);
  }

  // 只保留最新的两帧（上一帧用于过渡淡出）
  function pruneFrames(layer) {
    var frames = layer.querySelectorAll(".bgFrame");
    for (var i = 0; i < frames.length - 2; i++) frames[i].remove();
  }

  function renderVideo(entry) {
    var v = ensureVideo();
    var layer = ensureLayer();
    var frames = layer.querySelectorAll(".bgFrame");
    for (var i = 0; i < frames.length; i++) frames[i].remove();
    if (v.getAttribute("src") !== entry.url) {
      v.setAttribute("src", entry.url);
      if (entry.poster) v.setAttribute("poster", entry.poster);
      v.load();
    }
    v.style.display = "";
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* 自动播放被拦截时忽略 */ });
  }

  function caption(entry) {
    var el = $("bg");
    if (!el) return;
    el.innerHTML = "背景: " + (entry.author || "未知") + (entry.name ? " - " + entry.name : "") + " (" + (entry.vol || entry.sourceId || "") + ")";
  }

  /* 应用一组背景（供后端 / 外部调用）：可以是条目数组或单条目 */
  function apply(entry) {
    if (!BG.data) return entry;
    var st = BG.data.settings;
    applyEffects(entry);

    if (entry.kind === "video") {
      renderVideo(entry);
      finish(entry);
      return entry;
    }

    if (entry.kind === "css") {
      renderCss(entry);
      finish(entry);
      return entry;
    }

    var u = url(entry);
    if (!u) { next(true); return entry; }

    preload(u).then(function (ok) {
      if (ok) { renderImage(entry, u); finish(entry); return; }
      console.warn("[bg] 加载失败，已跳过：", u);
      entry.failed = true;
      BG.failed = (BG.failed || 0) + 1;
      // 连续失败过多时，退化到内置渐变，保证画面永远不为空
      if (BG.failed >= 12) {
        BG.failed = 0;
        renderCss(BG.fallback());
        finish(BG.fallback());
        return;
      }
      next(true);
    });
    return entry;
  }

  /* 兜底背景：网络全挂时也不会白屏 */
  BG.fallback = function () {
    return {
      kind: "css", author: "系统", name: "兜底渐变", vol: "内置",
      css: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)"
    };
  };

  function finish(entry) {
    BG.current = entry;
    BG.lastApplied = entry;
    // 兼容旧接口：cover.js 会读取 bg.cur
    BG.history.push(entry.url || entry.css || entry.api || "");
    if (BG.history.length > 20) BG.history.shift();
    if (BG.data.settings.showCaption !== false) caption(entry);
    if (doc.body) doc.body.setAttribute("data-bg-author", entry.author || "");
    schedule();
  }

  /* ------------------------------------------------------------- 调度 */
  function schedule() {
    clearTimeout(BG.timer);
    if (!BG.data || !BG.data.settings.enabled) return;
    var ms = clamp(BG.data.settings.intervalSeconds || 120, 5, 86400) * 1000;
    BG.timer = setTimeout(function () { next(); }, ms);
  }

  function allowed(entry) {
    var st = BG.data.settings;
    if (st.order !== "random") return true;
    var sig = entry.url || entry.css || entry.api || "";
    return BG.history.slice(-clamp(st.avoidRepeat || 2, 0, 10)).indexOf(sig) < 0;
  }

  /* 下一张：随机或顺序 */
  function next(silent) {
    if (!BG.data) return null;
    if (!BG.plan.length) { rebuild(); }
    if (!BG.plan.length) { console.warn("[bg] 没有可用背景，已保留当前背景。"); return null; }
    var entry = null;
    if (BG.data.settings.order === "sequence") {
      BG.seq = ((BG.seq || 0) + 1) % BG.plan.length;
      entry = BG.plan[BG.seq];
    } else {
      for (var i = 0; i < 12; i++) {
        var c = weightedPick(BG.plan);
        if (allowed(c)) { entry = c; break; }
      }
      entry = entry || weightedPick(BG.plan);
    }
    return apply(entry);
  }

  function weightedPick(pool) {
    var total = 0, i;
    for (i = 0; i < pool.length; i++) total += pool[i].weight || 1;
    var r = Math.random() * total;
    for (i = 0; i < pool.length; i++) {
      r -= pool[i].weight || 1;
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /* --------------------------------------------------------- 初始化 */
  function rebuild() {
    BG.plan = planFromConfig(BG.data);
    BG.failed = 0;
  }

  function loadConfig() {
    var base = global.BG_DATA || { settings: {}, items: [] };
    var local = readLocal();
    var cfg = {
      settings: mergeSettings(base.settings, local && local.settings),
      items: (local && local.items) || deepCopy(base.items)
    };
    // 保证内置数据里的 list 在本地覆盖时也能补全
    if (local && local.items) {
      local.items.forEach(function (it) {
        if (it.type !== "gallery" && it.type !== "online" && it.type !== "bing") return;
        var src = (base.items || []).filter(function (b) { return b.id === it.id; })[0];
        if (src) {
          if (src.api) it.api = it.api || src.api;
          if (src.topics && !it.topics) it.topics = src.topics;
          if (src.suffix != null && it.suffix == null) it.suffix = src.suffix;
          if (src.base && !it.base) it.base = src.base;
        }
      });
    }
    BG.data = cfg;
  }

  function saveConfig(cfg) {
    BG.data = cfg;
    writeLocal(cfg);
    rebuild();
    start();
  }

  function start() {
    clearTimeout(BG.timer);
    if (!BG.ready) return;
    rebuild();
    next();
  }

  function init() {
    if (BG.ready) return BG;
    loadConfig();
    ensureLayer();
    applyEffects(null);
    rebuild();
    // 异步补充必应壁纸
    (BG.data.items || []).forEach(function (it) {
      if (it.type === "bing" && it.enabled !== false) {
        fetchBing(it).then(function () { rebuild(); });
      }
    });
    BG.ready = true;
    next();
    doc.addEventListener("visibilitychange", function () {
      if (doc.hidden) clearTimeout(BG.timer);
      else if (BG.data.settings.pauseWhileHidden !== false) schedule();
    });
    return BG;
  }

  /* --------------------------------------------------- 兼容旧接口 */
  // 旧版：bg("Nov21") 指定图库卷；bg() 随机
  function legacyBg(vol) {
    if (!BG.ready) init();
    if (vol && global.gallery && vol in global.gallery) {
      var info = getBg(vol);
      BG.data = BG.data || { settings: {}, items: [] };
      if (!BG.data.settings) BG.data.settings = {};
      BG.data.settings.enabled = false; // 指定单张时暂停轮播
      clearTimeout(BG.timer);
      apply({ kind: "image", author: info.author, name: info.name, vol: info.vol, url: info.url });
      return "背景: " + info.author + " - " + info.name + " (" + info.vol + ")";
    }
    return next();
  }

  global.BG = BG;
  global.bg = legacyBg;
  global.bgNext = function () { return next(); };
  global.bgSet = function (entry) { return apply(entry); };
  // 兼容旧代码：bg.cur 保存当前背景信息
  try {
    Object.defineProperty(legacyBg, "cur", {
      get: function () { return BG.current || { author: "", name: "", vol: "", url: "" }; },
      set: function (v) { BG.current = v; }
    });
  } catch (e) { }
  global.bg.interval = null;
  global.bgApplySource = function (sourceId) {
    if (!BG.ready) init();
    var items = BG.data.items.filter(function (i) { return i.id === sourceId || i.name === sourceId; });
    if (!items.length) return null;
    var entries = planFromConfig({ items: items });
    if (!entries.length) return null;
    var e = weightedPick(entries);
    BG.data.settings.enabled = false;
    clearTimeout(BG.timer);
    return apply(e);
  };
  global.bgSources = function () {
    if (!BG.ready) init();
    return BG.data.items.map(function (i) {
      return { id: i.id, name: i.name, type: i.type, weight: i.weight, count: planFromConfig({ items: [i] }).length };
    });
  };
  global.bgConfig = function () { return BG.data; };
  global.bgSave = saveConfig;
  global.bgInit = init;
  // 图库等数据晚于本脚本加载时，重新计算候选池
  global.bgRebuild = function () { if (!BG.ready) return init(); rebuild(); return BG.plan.length; };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
