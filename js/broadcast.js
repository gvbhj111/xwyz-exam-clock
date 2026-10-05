/*
 * 考试广播引擎（Exam Broadcast）
 * ------------------------------------------------------------------
 * 能力：
 *   · 语音播报（Web Speech API，自动挑选中文语音）
 *   · 顶部横幅 + 广播中心（通知历史 / 手动重播）
 *   · 考试节点自动播报：开考前 N 分钟、开考、开考后提示、结束前 N 分钟、结束
 *   · 整点报时、考场纪律轮播
 *   · 外部广播（后台发出的消息）实时下发
 *   · 播报前提示音、防抖、去重、静音开关
 *
 * 依赖：feed-store.js（广播数据源）
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var Store = global.FeedStore;
  var cfg = function () { return (Store && Store.getConfig()) || global.BROADCAST_CONFIG || {}; };
  var settings = function () { return cfg().settings || {}; };

  var ENGINE = {
    ready: false,
    muted: false,
    unlocked: false,
    queue: [],
    speaking: false,
    lastSpeakAt: 0,
    announced: {},
    lastSlotKeys: {},
    ui: {},
    offsetMs: 0,
    log: []
  };

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function clock(d) { return d.getHours() + ":" + pad(d.getMinutes()); }
  function nowDate() { return new Date(Date.now() + ENGINE.offsetMs); }
  function stripTags(html) { return String(html || "").replace(/<[^>]*>/g, "").replace(/&emsp;/g, " ").replace(/&nbsp;/g, " "); }
  function fmt(tpl, vars) { return String(tpl || "").replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ""; }); }

  function levelOf(m) {
    var lv = (m && m.level) || "notice";
    return ["info", "notice", "important", "urgent"].indexOf(lv) >= 0 ? lv : "notice";
  }

  /* ============================================================ 声音 */
  function chime() {
    var st = settings();
    if (!st.chime) return Promise.resolve();
    return new Promise(function (resolve) {
      try {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        if (!Ctx) return resolve();
        ENGINE.ctx = ENGINE.ctx || new Ctx();
        var ctx = ENGINE.ctx;
        if (ctx.state === "suspended") ctx.resume();
        var t0 = ctx.currentTime;
        [880, 1320].forEach(function (f, i) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine"; o.frequency.value = f;
          g.gain.setValueAtTime(0.0001, t0 + i * 0.18);
          g.gain.exponentialRampToValueAtTime(0.12, t0 + i * 0.18 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.18 + 0.3);
          o.connect(g); g.connect(ctx.destination);
          o.start(t0 + i * 0.18); o.stop(t0 + i * 0.18 + 0.32);
        });
        setTimeout(resolve, 420);
      } catch (e) { resolve(); }
    });
  }

  function pickVoice() {
    if (!global.speechSynthesis) return null;
    var st = settings();
    var voices = global.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    if (st.voiceName) {
      var hit = voices.filter(function (v) { return v.name === st.voiceName; })[0];
      if (hit) return hit;
    }
    var zh = voices.filter(function (v) { return /zh|Chinese|中文|普通话|Yaoyao|Huihui|Kangkang|Xiaoxiao/i.test(v.name + " " + v.lang); });
    return zh[0] || voices[0];
  }

  function speak(text, opts) {
    opts = opts || {};
    var st = settings();
    if (!st.voice || ENGINE.muted) return;
    var clean = stripTags(text).trim();
    if (!clean) return;
    if (!global.speechSynthesis) { showTextFallback(clean); return; }
    var gap = (opts.gap == null ? +(st.minGapSeconds || 6) : opts.gap) * 1000;
    var since = Date.now() - ENGINE.lastSpeakAt;
    if (since < gap) {
      setTimeout(function () { speak(text, opts); }, gap - since);
      return;
    }
    ENGINE.lastSpeakAt = Date.now();
    try {
      var u = new SpeechSynthesisUtterance(clean);
      u.lang = st.lang || "zh-CN";
      u.rate = Math.min(2, Math.max(0.5, +(st.rate || 1)));
      u.pitch = Math.min(2, Math.max(0, +(st.pitch || 1)));
      u.volume = Math.min(1, Math.max(0, +(st.volume == null ? 1 : st.volume)));
      var v = pickVoice();
      if (v) u.voice = v;
      u.onstart = function () { ENGINE.speaking = true; };
      u.onend = function () { ENGINE.speaking = false; };
      u.onerror = function () { ENGINE.speaking = false; };
      global.speechSynthesis.speak(u);
    } catch (e) { console.warn("[broadcast] 语音播报失败", e); }
  }

  function stopSpeak() {
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (e) { }
    ENGINE.speaking = false;
  }

  /* 浏览器不支持语音合成时，退化为页内文字提示 */
  function showTextFallback(text) {
    var ui = ENGINE.ui;
    if (!ui.wrap || !ui.text) return;
    ui.wrap.setAttribute("data-level", "important");
    ui.wrap.style.display = "";
    if (ui.title) ui.title.innerHTML = "语音播报（浏览器不支持语音，已转为文字提示）";
    ui.text.innerHTML = text;
    requestAnimationFrame(function () { ui.wrap.classList.add("show"); });
  }

  /* ============================================================ 通知 */
  function notify(title, body) {
    var st = settings();
    if (!st.notify || !("Notification" in global)) return;
    if (Notification.permission === "granted") {
      try { new Notification(title, { body: body, icon: "./favicon.ico", tag: "examclock" }); } catch (e) { }
    }
  }

  /* ============================================================ 播报 */
  /*
   * @param text  播报文本
   * @param opts  { level, voice, title, silent, dedupeKey, source, duration }
   */
  function announce(text, opts) {
    opts = opts || {};
    var st = settings();
    if (!text) return null;
    var key = opts.dedupeKey;
    if (key && ENGINE.announced[key]) return null;
    if (key) ENGINE.announced[key] = Date.now();

    var item = {
      id: key || ("a-" + Date.now()),
      at: new Date().toISOString(),
      level: levelOf(opts),
      title: opts.title || levelTitle(opts.level),
      text: text,
      voice: opts.voice === false ? "" : (opts.voice || text),
      source: opts.source || "考试广播"
    };

    if (!st.enabled) { logAnnouncement(item, "disabled"); return item; }

    show(item, opts);
    if (opts.voice !== false) {
      chime().then(function () { speak(item.voice || item.text, opts); });
    }
    notify(item.title, stripTags(item.text));
    // 大屏幕上顺带弹出封面，提示更醒目（试卷封面 / 科目信息）
    try { if (global.playCover) global.playCover(stripTags(item.text)); } catch (e) { }
    logAnnouncement(item, "announced");
    return item;
  }

  function levelTitle(level) {
    return { info: "提示", notice: "通知", important: "重要提醒", urgent: "紧急广播" }[levelOf({ level: level })] || "广播";
  }

  function logAnnouncement(item, status) {
    item.status = status;
    ENGINE.log.unshift(item);
    ENGINE.log = ENGINE.log.slice(0, 200);
    if (Store) Store.addHistory(item);
    renderLog();
  }

  /* ============================================================ 界面 */
  function cacheUI() {
    ENGINE.ui.wrap = document.getElementById("alert");
    ENGINE.ui.text = document.getElementById("alertText");
    ENGINE.ui.title = document.getElementById("alertTitle");
    ENGINE.ui.time = document.getElementById("alertTime");
    ENGINE.ui.close = document.getElementById("alertClose");
    ENGINE.ui.log = document.getElementById("alertLog");
    ENGINE.ui.mute = document.getElementById("alertMute");
  }

  function show(item, opts) {
    var ui = ENGINE.ui;
    if (!ui.wrap) return;
    ui.wrap.setAttribute("data-level", item.level);
    ui.wrap.style.display = "";
    if (ui.title) ui.title.innerHTML = (item.pin ? "📌 " : "") + item.title;
    if (ui.text) ui.text.innerHTML = item.text;
    if (ui.time) ui.time.innerHTML = clock(new Date()) + " · " + item.source;
    clearTimeout(ENGINE.hideTimer);
    var dur = opts.duration || (item.level === "urgent" ? 0 : (item.pin ? 0 : 40));
    if (dur) ENGINE.hideTimer = setTimeout(hideAlert, dur * 1000);
    requestAnimationFrame(function () { ui.wrap.classList.add("show"); });
  }

  function hideAlert(id) {
    var ui = ENGINE.ui;
    if (!ui.wrap) return;
    ui.wrap.classList.remove("show");
    ENGINE.hideTimer = setTimeout(function () { ui.wrap.style.display = "none"; }, 400);
  }

  function renderLog() {
    var ui = ENGINE.ui;
    if (!ui.log) return;
    var list = ENGINE.log.slice(0, 50);
    if (!list.length) { ui.log.innerHTML = '<li class="dim">暂无播报记录</li>'; return; }
    ui.log.innerHTML = list.map(function (x) {
      return '<li data-level="' + x.level + '"><b>' + clock(new Date(x.at)) + "</b> " + stripTags(x.text) +
        (x.status === "announced" ? "" : ' <span class="dim">(' + x.status + ")</span>") + "</li>";
    }).join("");
  }

  /* ============================================================ 考试节点 */
  function template(kind, vars) {
    var t = (cfg().exam && cfg().exam.templates) || {};
    return fmt(t[kind] || defaultTemplates[kind] || "{subject}", vars);
  }

  var defaultTemplates = {
    beforeStart: "距离{subject}开考还有{minutes}分钟，请考生尽快入场。",
    start: "{subject}考试现在开始。",
    afterStart: "{subject}考试已进行{minutes}分钟。",
    beforeEnd: "距离{subject}考试结束还有{minutes}分钟。",
    end: "{subject}考试结束，请立即停止作答。"
  };

  function checkExam() {
    var st = cfg().exam || {};
    if (!st.enabled) return;
    if (typeof subject === "undefined" || typeof exams === "undefined") return;
    if (!subject.start || !subject.end || !subject.name) return;
    var d = nowDate();
    if (isNaN(+subject.start) || isNaN(+subject.end)) return;
    var name = String(subject.name || "").trim();
    if (!name) return;
    var dateKey = d.toISOString().slice(0, 10);
    var base = dateKey + "|" + name + "|";
    var start = +subject.start, end = +subject.end, t = +d;
    var minutes;

    (st.beforeStart || []).forEach(function (m) {
      minutes = m;
      if (t >= start - m * 60000 && t < start - m * 60000 + 60000) {
        announce(template("beforeStart", { subject: name, minutes: m }), { level: "important", dedupeKey: base + "b" + m, source: "考试节点" });
      }
    });
    if (st.afterStart) {
      [0].concat(st.afterStart || []).forEach(function (m) {
        if (!m) {
          if (t >= start && t < start + 60000) {
            announce(template("start", { subject: name, minutes: 0 }), { level: "urgent", dedupeKey: base + "s0", source: "考试节点" });
          }
        } else if (t >= start + m * 60000 && t < start + m * 60000 + 60000) {
          announce(template("afterStart", { subject: name, minutes: m }), { level: "info", dedupeKey: base + "s" + m, source: "考试节点" });
        }
      });
    }
    (st.beforeEnd || []).forEach(function (m) {
      if (t >= end - m * 60000 && t < end - m * 60000 + 60000) {
        announce(template("beforeEnd", { subject: name, minutes: m }), { level: "important", dedupeKey: base + "e" + m, source: "考试节点" });
      }
    });
    if (st.afterEnd && t >= end && t < end + 60000) {
      announce(template("end", { subject: name, minutes: 0 }), { level: "urgent", dedupeKey: base + "e0", source: "考试节点" });
    }
  }

  function duringExam() {
    if (typeof subject === "undefined" || !subject.start || !subject.end) return false;
    var t = +nowDate();
    return t >= +subject.start && t <= +subject.end;
  }

  /* 整点报时 */
  function checkClockRule() {
    var c = cfg().clock || {};
    if (!c.enabled) return;
    var d = nowDate();
    if (c.onlyDuringExam && !duringExam()) return;
    (c.minutes || []).forEach(function (m) {
      if (d.getMinutes() === m && d.getSeconds() < 2) {
        announce(fmt(c.template || "现在时间是{time}。", { time: clock(d) }), {
          level: "info", dedupeKey: "clock|" + d.toISOString().slice(0, 16), source: "整点报时"
        });
      }
    });
  }

  /* 考场纪律轮播 */
  function checkDiscipline() {
    var c = cfg().discipline || {};
    if (!c.enabled || !(c.items || []).length) return;
    if (c.onlyDuringExam && !duringExam()) return;
    var every = Math.max(1, +(c.everyMinutes || 30));
    var d = nowDate();
    var slot = Math.floor((d.getHours() * 60 + d.getMinutes()) / every);
    if (d.getMinutes() % every !== 0 || d.getSeconds() > 2) return;
    var key = "discipline|" + d.toISOString().slice(0, 10) + "|" + slot;
    var text = (c.items || [])[slot % (c.items || []).length];
    announce(text, { level: "info", dedupeKey: key, source: "考场纪律" });
  }

  /* 外部广播（后台发出的消息） */
  function checkFeed() {
    if (!Store) return;
    var list = Store.active();
    list.forEach(function (m) {
      if (m.announce === "slot") return;               // 交给节点引擎
      if (Store.seen(m.id)) return;
      // 只有刚刚发布（10 分钟内）的广播才自动播报，避免刷新页面历史轰炸
      var age = Date.now() - new Date(m.at || 0).getTime();
      Store.markSeen(m.id);
      if (age > 10 * 60000) return;
      announce(m.text, {
        level: m.level, voice: m.voice || m.text, pin: m.pin,
        dedupeKey: "feed|" + m.id, source: m.source || "广播中心",
        duration: m.pin ? 0 : 60
      });
    });
  }

  /* ============================================================ 时间同步 */
  function syncTime() {
    var c = cfg().timeSync || {};
    if (!c.enabled || !c.url || !global.fetch) return;
    fetch(c.url, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return;
        var v = c.field ? j[c.field] : j.datetime;
        if (!v) return;
        var remote = new Date(v).getTime();
        if (isNaN(remote)) return;
        ENGINE.offsetMs = remote - Date.now() + (+c.offsetMs || 0);
        console.log("[broadcast] 时间已校准，偏移(ms)：", ENGINE.offsetMs);
      })
      .catch(function () { /* 网络不可用时忽略 */ });
  }

  /* ============================================================ 启动 */
  function tick() {
    if (!ENGINE.ready) return;
    try { checkExam(); } catch (e) { console.error(e); }
    try { checkClockRule(); } catch (e) { }
    try { checkDiscipline(); } catch (e) { }
  }

  function bindUI() {
    var ui = ENGINE.ui;
    if (ui.close) ui.close.onclick = function () { hideAlert(); };
    if (ui.mute) {
      ENGINE.muted = localStorage.getItem("examclock.broadcast.muted") === "1";
      paintMute();
      ui.mute.onclick = function () {
        ENGINE.muted = !ENGINE.muted;
        localStorage.setItem("examclock.broadcast.muted", ENGINE.muted ? "1" : "0");
        if (ENGINE.muted) stopSpeak();
        paintMute();
      };
    }
    var btnReplay = document.getElementById("alertReplay");
    if (btnReplay) btnReplay.onclick = function () {
      var last = ENGINE.log[0];
      if (last) { ENGINE.lastSpeakAt = 0; speak(last.voice || last.text, { gap: 0 }); }
    };
    var btnPanel = document.getElementById("alertPanelBtn");
    var panel = document.getElementById("alertPanel");
    if (btnPanel && panel) btnPanel.onclick = function () { panel.classList.toggle("open"); };
    var btnNotif = document.getElementById("alertNotifyPerm");
    if (btnNotif) btnNotif.onclick = function () {
      if ("Notification" in global) Notification.requestPermission().then(function (p) {
        btnNotif.textContent = p === "granted" ? "通知已开启" : "通知被拒绝";
      });
    };
    var btnClear = document.getElementById("alertClearLog");
    if (btnClear) btnClear.onclick = function () { ENGINE.log = []; if (Store) Store.clearHistory(); renderLog(); };
  }

  function paintMute() {
    var el = ENGINE.ui.mute;
    if (!el) return;
    el.className = ENGINE.muted ? "fa-solid fa-volume-xmark" : "fa-solid fa-volume-high";
    el.setAttribute("data-sub", ENGINE.muted ? "已静音" : "语音开");
  }

  function init() {
    if (ENGINE.ready) return ENGINE;
    if (!Store) { console.warn("[broadcast] 缺少 feed-store.js"); return ENGINE; }
    if (!Store.config) Store.init();
    cacheUI();
    bindUI();
    renderLog();
    ENGINE.ready = true;
    if (settings().showBanner === false) document.documentElement.classList.add("no-banner");

    // 语音列表异步加载
    if (global.speechSynthesis) {
      global.speechSynthesis.onvoiceschanged = function () { pickVoice(); };
      pickVoice();
    }

    syncTime();
    Store.startPolling();
    Store.on(function (evt) {
      if (evt.type === "history") { renderLog(); return; }
      if (evt.type === "message") { checkFeed(); return; }
      checkFeed();
    });
    checkFeed();
    setInterval(tick, 1000);
    // 首次交互后解锁音频（浏览器自动播放策略）
    ["click", "keydown", "touchstart"].forEach(function (ev) {
      doc_unlock(ev);
    });
    console.log("%c[考试广播] 已启动", "color:#3a9;font-weight:bold");
    return ENGINE;
  }

  function doc_unlock(ev) {
    document.addEventListener(ev, function () {
      if (ENGINE.unlocked) return;
      ENGINE.unlocked = true;
      try {
        var Ctx = global.AudioContext || global.webkitAudioContext;
        if (Ctx) { ENGINE.ctx = ENGINE.ctx || new Ctx(); ENGINE.ctx.resume(); }
        if (global.speechSynthesis) { var u = new SpeechSynthesisUtterance(""); u.volume = 0; global.speechSynthesis.speak(u); }
      } catch (e) { }
      // 首次交互时顺便申请系统通知权限（浏览器要求用户手势）
      try {
        if (settings().notify && "Notification" in global && Notification.permission === "default") {
          Notification.requestPermission();
        }
      } catch (e) { }
    }, { once: true, passive: true });
  }

  /* ============================================================ 对外接口 */
  global.Broadcast = {
    init: init,
    engine: ENGINE,
    announce: announce,
    speak: speak,
    stop: stopSpeak,
    test: function (level) {
      return announce("这是一条考试广播测试，语音播报功能工作正常。", { level: level || "notice", voice: true, source: "测试", dedupeKey: "test|" + Date.now() });
    },
    isMuted: function () { return ENGINE.muted; },
    setMuted: function (v) {
      ENGINE.muted = !!v;
      localStorage.setItem("examclock.broadcast.muted", ENGINE.muted ? "1" : "0");
      if (ENGINE.muted) stopSpeak();
      paintMute();
    },
    reloadConfig: function () { if (Store) { Store.init(); } },
    history: function () { return ENGINE.log; }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
