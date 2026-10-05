/*
 * 背景控制面板（UI）
 * ------------------------------------------------------------------
 * 把"背景轮播"的设置搬到导航栏的下拉菜单里，普通用户也能自己换：
 *   · 按来源切换（图库 / 必应每日 / 在线随机 / 渐变 / 本地图片 / 视频）
 *   · 切换间隔、画面效果、自动轮播开关
 *   · 自定义图片或网址、恢复默认
 * 设置保存在浏览器 localStorage，不影响其他人看到的内容。
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";
  var doc = document;

  function $(id) { return doc.getElementById(id); }
  function el(tag, cls, html) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function chip(text, onClick) {
    var a = el("a", null, text);
    a.onclick = onClick;
    return a;
  }
  function notice(msg) {
    if (global.send) send(msg);
    else console.log(msg);
  }

  var INTERVALS = [
    ["30 秒", 30], ["1 分钟", 60], ["2 分钟", 120], ["5 分钟", 300],
    ["10 分钟", 600], ["30 分钟", 1800], ["1 小时", 3600], ["不轮播", 0]
  ];
  var EFFECTS = [
    ["原图", "none"], ["模糊", "blur"], ["黑白", "gray"],
    ["暖色", "warm"], ["冷色", "cool"], ["压暗", "dark"]
  ];

  function currentConfig() {
    return global.bgConfig ? global.bgConfig() : null;
  }

  function save(settings) {
    var cfg = currentConfig();
    if (!cfg) return;
    Object.keys(settings).forEach(function (k) { cfg.settings[k] = settings[k]; });
    if (global.bgSave) global.bgSave(cfg);
  }

  /* 来源按钮 */
  function renderSources() {
    var box = $("bgSourceList");
    if (!box || !global.bgSources) return;
    box.innerHTML = "";
    var all = chip('<i class="fa-solid fa-shuffle"></i> 随机混合', function () {
      var cfg = currentConfig();
      cfg.settings.enabled = true;
      cfg.items.forEach(function (i) { if (i.type !== "local" || i.id === "local-repo") i.enabled = i.weight > 0; });
      if (global.bgSave) global.bgSave(cfg);
      notice("已恢复为多来源随机轮播");
    });
    all.setAttribute("data-primary", "1");
    box.appendChild(all);

    global.bgSources().forEach(function (s) {
      if (s.id === "gallery-all") return; // 与内置图库重复，避免刷屏
      var label = s.name + (s.count ? "(" + s.count + ")" : "");
      box.appendChild(chip(label, function () {
        global.bgApplySource(s.id);
        notice("已切换到：" + s.name);
      }));
    });
  }

  /* 间隔按钮 */
  function renderIntervals() {
    var box = $("bgIntervalList");
    if (!box) return;
    box.innerHTML = "";
    var cur = (currentConfig() && currentConfig().settings.intervalSeconds) || 120;
    INTERVALS.forEach(function (pair) {
      var a = chip(pair[0], function () {
        if (!pair[1]) {
          save({ enabled: false });
          notice("已关闭自动轮播，可手动点击“下一张”。");
        } else {
          save({ enabled: true, intervalSeconds: pair[1] });
          notice("背景将每 " + pair[0] + " 自动切换一次");
        }
        refreshActive();
      });
      if (pair[1] === cur) a.setAttribute("data-active", "1");
      box.appendChild(a);
    });
  }

  /* 效果按钮 */
  function renderEffects() {
    var box = $("bgEffectList");
    if (!box) return;
    box.innerHTML = "";
    var cfg = currentConfig();
    EFFECTS.forEach(function (pair) {
      var a = chip(pair[0], function () {
        save({ effect: pair[1] });
        notice("画面效果：" + pair[0]);
        refreshActive();
      });
      if (cfg && cfg.settings.effect === pair[1]) a.setAttribute("data-active", "1");
      box.appendChild(a);
    });
  }

  function refreshActive() {
    var cfg = currentConfig();
    if (!cfg) return;
    var t = $("bgPlayToggle");
    if (t) t.innerHTML = cfg.settings.enabled ? "暂停轮播" : "继续轮播";
    doc.querySelectorAll("#bgIntervalList a").forEach(function (a) { a.removeAttribute("data-active"); });
    INTERVALS.forEach(function (pair, i) {
      if (pair[1] === cfg.settings.intervalSeconds && cfg.settings.enabled) {
        var nodes = doc.querySelectorAll("#bgIntervalList a");
        if (nodes[i]) nodes[i].setAttribute("data-active", "1");
      }
    });
  }

  /* 自动轮播开关 */
  global.bgTogglePlay = function () {
    var cfg = currentConfig();
    var on = !cfg.settings.enabled;
    save({ enabled: on });
    refreshActive();
    if (!on) global.bgNext();
    notice(on ? "已开始自动轮播" : "已暂停自动轮播");
  };

  /* 自定义图片 / 网址 */
  global.bgSetCustom = function () {
    var url = prompt("请输入图片网址（http/https）或本地图片相对路径，例如 ./images/1.jpg", "https://");
    if (!url) return;
    url = url.trim();
    if (!url) return;
    var cfg = currentConfig();
    var id = "user-custom";
    var item = cfg.items.filter(function (i) { return i.id === id; })[0];
    if (!item) {
      item = { id: id, type: "custom", name: "我的自定义背景", weight: 1, enabled: true, list: [] };
      cfg.items.unshift(item);
    }
    item.list.unshift({ author: "自定义", name: new Date().toLocaleString(), url: url });
    item.list = item.list.slice(0, 20);
    cfg.settings.enabled = false;
    global.bgSave(cfg);
    global.bgSet({ kind: "image", author: "自定义", name: "", vol: "我的自定义背景", url: url });
    notice("已应用自定义背景");
    renderSources();
  };

  global.bgClearCustom = function () {
    var cfg = currentConfig();
    cfg.items = cfg.items.filter(function (i) { return i.id !== "user-custom"; });
    cfg.settings.enabled = true;
    global.bgSave(cfg);
    notice("已清除自定义背景，恢复默认轮播");
    renderSources();
  };

  /* 套用站点外观（js/site-data.js） */
  function applyTheme() {
    var t = (global.SITE_DATA && global.SITE_DATA.theme) || null;
    if (!t) return;
    function set(id, val) {
      var e = $(id);
      if (e && val) e.innerHTML = val;
    }
    set("mainslogan", t.slogan);
    set("coverTitle", t.slogan);
    set("coverAuthor", t.school);
    set("coverOrigin", t.school);
    set("coverTips", t.tip);
    var foot = doc.querySelector("footer p:last-child");
    if (foot && t.version) foot.innerHTML = '<i class="fa-solid fa-file-arrow-up"></i> ' + t.version;
    if (t.accent) {
      doc.documentElement.style.setProperty("--accent", t.accent);
      var st = doc.createElement("style");
      st.textContent = "a:hover{background:linear-gradient(120deg," + t.accent + ",#a7f)!important}";
      doc.head.appendChild(st);
    }
    if (t.darken != null && global.bgConfig && global.bgSave) {
      var cfg = global.bgConfig();
      cfg.settings.darken = t.darken;
      global.bgSave(cfg);
    }
  }

  function init() {
    applyTheme();
    renderSources();
    renderIntervals();
    renderEffects();
    refreshActive();
  }

  /* 供其它模块 / 调试使用 */
  global.bgApplyTheme = applyTheme;
  global.bgRefreshUI = function () { renderSources(); renderIntervals(); renderEffects(); refreshActive(); };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
