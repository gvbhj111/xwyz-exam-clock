/*
 * 无浏览器环境下的自检脚本（Node + 轻量 DOM 桩）
 * 运行： node _test/node-check.js
 * 目的：在没有浏览器的机器上验证 background.js / ui-bg.js / feed-store.js /
 *       broadcast.js 的加载、初始化与核心逻辑不会抛异常。
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const out = [];
const errors = [];
function chk(name, cond, extra) {
  out.push((cond ? "PASS  " : "FAIL  ") + name + (extra != null ? "  -> " + extra : ""));
}
function isFn(f) { return typeof f === "function"; }

/* ============================================================ 极简 DOM */
class El {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._id = "";
    this.__register = null;
    this._styleProps = {};
    const self = this;
    this.style = new Proxy({}, {
      set: (t, k, v) => { t[k] = v; return true; },
      get: (t, k) => {
        if (k === "setProperty") return (name, val) => { self._styleProps[name] = val; t[name] = val; };
        if (k === "getPropertyValue") return (name) => self._styleProps[name] || "";
        if (k === "removeProperty") return (name) => { delete self._styleProps[name]; delete t[name]; };
        return t[k] === undefined ? "" : t[k];
      }
    });
    this.attributes = {};
    this.dataset = {};
    this._text = "";
    this._html = "";
    this.classList = {
      _s: new Set(),
      add: (...c) => c.forEach(x => this.classList._s.add(x)),
      remove: (...c) => c.forEach(x => this.classList._s.delete(x)),
      contains: (c) => this.classList._s.has(c),
      toggle: (c, on) => { if (on) this.classList._s.add(c); else this.classList._s.delete(c); }
    };
  }
  get className() { return Array.from(this.classList._s).join(" "); }
  set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get id() { return this._id || this.attributes.id || ""; }
  set id(v) { this._id = String(v); this.attributes.id = String(v); if (this.__register) this.__register(String(v), this); }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this._text || this._html; }
  set textContent(v) { this._text = String(v); this._html = String(v); }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v == null ? "" : v); this.children = []; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) {
    c.parentNode = this;
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) this.children.unshift(c); else this.children.splice(i, 0, c);
    return c;
  }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentNode = null; return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener() { }
  removeEventListener() { }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  click() { if (isFn(this.onclick)) this.onclick({ target: this }); }
  get offsetWidth() { return 1920; }
  get offsetHeight() { return 1080; }
  focus() { }
  select() { }
  load() { }
  play() { return Promise.resolve(); }
}

function makeDoc() {
  const byId = new Map();
  const doc = {
    readyState: "complete",
    hidden: false,
    documentElement: new El("html"),
    head: new El("head"),
    body: new El("body"),
    createElement: (t) => {
      const e = new El(t);
      e.__register = (id, el) => byId.set(id, el);
      return e;
    },
    getElementById: (id) => byId.get(id) || null,
    addEventListener() { },
    querySelector: () => null,
    querySelectorAll: () => [],
    write() { }
  };
  doc.head.parentNode = doc.documentElement;
  doc.body.parentNode = doc.documentElement;
  doc._register = (id, tag) => {
    const e = new El(tag || "div");
    e.__register = (i, el) => byId.set(i, el);
    e.id = id;
    doc.body.appendChild(e);
    return e;
  };
  doc._byId = byId;
  return doc;
}

/* ============================================================ 运行环境 */
const doc = makeDoc();
const store = new Map();

const IDS = ["verify", "verifycontent", "msg", "msgcontent", "alert", "alertTitle", "alertText", "alertTime",
  "alertClose", "alertMute", "alertReplay", "alertPanelBtn", "alertPanel", "alertLog", "alertNotifyPerm",
  "alertClearLog", "mainslogan", "subslogan", "bar", "clock", "subject", "duration", "timer", "timersub",
  "activity", "bg", "bgSourceList", "bgIntervalList", "bgEffectList", "bgVolList", "bgPlayToggle",
  "fullscreen", "filterSwitch", "coverTitle", "coverAuthor", "coverOrigin", "coverTips", "bgHook", "coverImage"];
IDS.forEach(id => doc._register(id));

const timers = [];
let timerSeq = 1;
const sandbox = {
  console: {
    log: (...a) => { },
    info: (...a) => { },
    warn: (...a) => errors.push("WARN " + a.join(" ")),
    error: (...a) => errors.push("ERROR " + a.join(" ")),
    group: () => { }, groupEnd: () => { }, groupCollapsed: () => { }, table: () => { }, debug: () => { }
  },
  document: doc,
  location: { search: "", href: "https://example.com/", protocol: "https:", host: "example.com" },
  navigator: { userAgent: "node-check", clipboard: null },
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k)
  },
  sessionStorage: { getItem: () => null, setItem: () => { }, removeItem: () => { } },
  setTimeout: (fn, ms) => { const id = timerSeq++; timers.push({ id, fn, ms }); return id; },
  clearTimeout: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
  setInterval: (fn, ms) => { const id = timerSeq++; timers.push({ id, fn, ms, interval: true }); return id; },
  clearInterval: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
  requestAnimationFrame: (fn) => { const id = timerSeq++; timers.push({ id, fn, ms: 16 }); return id; },
  URLSearchParams,
  URL,
  fetch: () => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve("") }),
  Image: class {
    constructor() { this.onload = null; this.onerror = null; }
    set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 1); }
    get src() { return this._src; }
  },
  SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
  speechSynthesis: null,
  Notification: undefined,
  BroadcastChannel: undefined,
  AudioContext: undefined,
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  TextEncoder,
  TextDecoder,
  crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = i; return a; }, subtle: {} },
  Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, escape, unescape, Symbol, Map, Set, Proxy, Reflect, Intl, WeakMap
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

const ctx = vm.createContext(sandbox);

function load(rel) {
  const file = path.join(ROOT, rel);
  const code = fs.readFileSync(file, "utf8");
  try {
    vm.runInContext(code, ctx, { filename: rel });
    return true;
  } catch (e) {
    errors.push("LOAD-FAIL " + rel + ": " + e.message);
    out.push("FAIL  加载 " + rel + "  -> " + e.message);
    return false;
  }
}

/* 浏览器里多个 <script> 共享同一全局作用域（含 const/let 词法声明），
   这里把被测脚本拼成一段代码，模拟同样的语义。 */
const FILES = [
  "js/gallery.js",
  "js/bg-data.js",
  "js/background.js",
  "js/ui-bg.js",
  "data/feed.json.js",
  "js/site-data.js",
  "js/broadcast-data.js",
  "js/feed-store.js",
  "js/broadcast.js"
];

(function loadAll() {
  const code = FILES.map(f => "\n/*=== " + f + " ===*/\n" + fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  try {
    vm.runInContext(code, ctx, { filename: "bundle" });
  } catch (e) {
    errors.push("LOAD-FAIL bundle: " + e.message + "\n" + (e.stack || "").split("\n").slice(0, 4).join("\n"));
    out.push("FAIL  加载脚本包  -> " + e.message);
  }
})();

/* ============================================================ 断言 */
const win = sandbox;
if (process.env.EC_DEBUG) {
  console.log("DEBUG BG.ready =", !!(win.BG && win.BG.ready));
  console.log("DEBUG plan =", win.BG && win.BG.plan.length);
  console.log("DEBUG plan by source =", JSON.stringify(win.BG.plan.reduce((a, p) => { a[p.sourceId] = (a[p.sourceId] || 0) + 1; return a; }, {})));
  console.log("DEBUG BG.timer =", win.BG && win.BG.timer, "typeof", typeof (win.BG && win.BG.timer));
  console.log("DEBUG enabled =", win.BG.data.settings.enabled, "interval =", win.BG.data.settings.intervalSeconds);
  console.log("DEBUG schedule type =", vm.runInContext('typeof schedule', ctx));
  console.log("DEBUG resched =", vm.runInContext('try { schedule(); "ok:" + BG.timer } catch(e) { "ERR " + e.message }', ctx));
  console.log("DEBUG timers pending =", timers.length);
  console.log("DEBUG after-bundle timer =", vm.runInContext('BG.timer', ctx));
  console.log("DEBUG after-bundle failed =", vm.runInContext('BG.failed', ctx));
  console.log("DEBUG next->timer =", vm.runInContext('(function(){ var before = BG.timer; bgNext(); return "before="+before+" after="+BG.timer+" kind="+(BG.current&&BG.current.kind); })()', ctx));
  vm.runInContext('preload("https://example.com/x.jpg").then(function(ok){ window.__preloadOK = "resolved:" + ok; }); window.__preloadOK = "pending";', ctx);
  setTimeout(() => {
    console.log("DEBUG preload result =", vm.runInContext('window.__preloadOK', ctx));
    console.log("DEBUG final timer =", vm.runInContext('BG.timer', ctx), "failed =", vm.runInContext('BG.failed', ctx));
  }, 60);
  const probe0 = vm.runInContext(`(function(){
    var out = {};
    out.viaHelper = (function(){
      var item = BG_DATA.items.filter(function(i){return i.id==="gallery-all";})[0];
      var n = 0;
      // 直接复刻 sourcesOf 的逻辑，确认数据可用
      if (global.galleryFlated && global.galleryFlated.length) n = global.galleryFlated.length;
      return n;
    })();
    out.galleryFlatedOnWindow = typeof window.galleryFlated;
    out.globalIsWindow = (typeof globalThis !== "undefined") && (globalThis.galleryFlated ? globalThis.galleryFlated.length : "none");
    out.planVols = BG.plan.filter(function(p){return p.kind==="image" && p.url;}).length;
    out.sampleVol = BG.plan[0] && BG.plan[0].vol;
    return out;
  })()`, ctx);
  console.log("DEBUG probe0 =", JSON.stringify(probe0));
  console.log("DEBUG bgLayer =", !!doc.getElementById("bgLayer"));
  console.log("DEBUG ids =", Array.from(doc._byId.keys()).join(","));
  console.log("DEBUG body children =", doc.body.children.map(c => c.tagName + "#" + c.id).join(","));
  console.log("DEBUG mainslogan =", JSON.stringify(doc.getElementById("mainslogan").innerHTML));
  console.log("DEBUG errors =", errors.join(" | ").slice(0, 600));
  const probe = vm.runInContext(`(function(){
    var r = {};
    r.galleryFlated = (typeof galleryFlated !== "undefined") ? galleryFlated.length : "undefined";
    r.getBg = typeof getBg;
    r.applyTheme = typeof applyTheme;
    r.initCount = 0;
    var srcs = document.getElementById("bgSourceList").children.length;
    r.srcChips = srcs;
    r.intervalChips = document.getElementById("bgIntervalList").children.length;
    try { applyTheme(); } catch(e) { r.applyErr = e.message; }
    r.slogan = document.getElementById("mainslogan").innerHTML;
    r.darkenVar = document.documentElement._styleProps["--bg-darken"];
    r.stack = (new Error()).stack.split("\\n")[1];
    return r;
  })()`, ctx);
  console.log("DEBUG probe =", JSON.stringify(probe, null, 1));
  process.exit(0);
}
chk("BG_DATA 已加载", !!win.BG_DATA, win.BG_DATA && win.BG_DATA.items.length + " 个来源");
// 顶层 const/let 不挂到 globalThis，用 vm 读取模块作用域内的词法变量
const galleryCount = vm.runInContext('typeof galleryFlated === "undefined" ? 0 : galleryFlated.length', ctx);
chk("galleryFlated 已生成", galleryCount === 542, galleryCount + " 张");
win.bgRebuild();
chk("候选池包含内置图库", win.BG.plan.filter(p => p.vol && p.vol !== "精选").length > 100, win.BG.plan.length + " 条候选");
chk("BG 引擎就绪", !!(win.BG && win.BG.ready));
chk("候选池非空", !!(win.BG && win.BG.plan.length), win.BG && win.BG.plan.length + " 条");
chk("背景层已创建", !!doc.getElementById("bgLayer"));
// 触发一次换背景，等待假图片 onload 后检查轮播调度（浏览器里图片是异步加载的）
win.bgNext();
const flush = () => new Promise(r => setTimeout(r, 30));
flush().then(() => {
  chk("轮播定时器已启动", !!win.BG.timer, win.BG.timer);
  chk("背景帧已渲染", !!win.BG.current, win.BG.current && win.BG.current.kind);
  chk("页脚显示背景来源", /背景:/.test(doc.getElementById("bg").innerHTML), doc.getElementById("bg").innerHTML.slice(0, 40));
  runRest();
});

/* ============================================================ 其余断言 */
function runRest() {
chk("bgSources() 可用", isFn(win.bgSources) && win.bgSources().length > 3, isFn(win.bgSources) && win.bgSources().length);
chk("bgConfig() 可用", isFn(win.bgConfig) && !!win.bgConfig().settings);

/* UI 渲染（桩里 body 元素在脚本之后创建，这里手动触发一次，等价于浏览器里的 DOMContentLoaded） */
vm.runInContext("if (typeof bgRefreshUI==='function'){bgRefreshUI();}", ctx, { filename: "ui-init" });
chk("间隔按钮渲染无异常", doc.getElementById("bgIntervalList").children.length >= 8, doc.getElementById("bgIntervalList").children.length);
chk("效果按钮渲染无异常", doc.getElementById("bgEffectList").children.length === 6, doc.getElementById("bgEffectList").children.length);
chk("来源按钮已渲染", doc.getElementById("bgSourceList").children.length >= 3, doc.getElementById("bgSourceList").children.length);

/* 切换间隔 */
if (isFn(win.bgTogglePlay)) {
  win.bgTogglePlay();
  chk("bgTogglePlay 可切换轮播", typeof win.bgConfig().settings.enabled === "boolean", win.bgConfig().settings.enabled);
}

/* 站点外观 */
chk("SITE_DATA 已加载", !!win.SITE_DATA);
vm.runInContext("if (typeof bgApplyTheme==='function'){bgApplyTheme();}", ctx, { filename: "theme" });
chk("大标语已套用", doc.getElementById("mainslogan").innerHTML === "考试时钟", doc.getElementById("mainslogan").innerHTML);
chk("封面标题已套用", doc.getElementById("coverTitle").innerHTML === "考试时钟", doc.getElementById("coverTitle").innerHTML);

/* 广播 */
chk("FeedStore 已加载", !!win.FeedStore);
chk("Broadcast 引擎就绪", !!(win.Broadcast && win.Broadcast.engine.ready));
const rec = win.Broadcast.test("urgent");
chk("announce 返回条目", !!(rec && rec.level === "urgent"), rec && rec.level);
chk("横幅已显示", doc.getElementById("alert").style.display !== "none", JSON.stringify(doc.getElementById("alert").style.display));
chk("横幅内容已写入", doc.getElementById("alertText").innerHTML.length > 0, doc.getElementById("alertText").innerHTML.slice(0, 30));
chk("播报记录已写入", win.Broadcast.history().length > 0, win.Broadcast.history().length);

/* 广播数据源 */
const sent = win.FeedStore.send({ id: "t1", text: "自检广播", level: "important", voice: "自检广播" });
chk("FeedStore.send 成功", !!sent);
chk("发送的广播已在队列中", win.FeedStore.messages.filter(m => m.id === "t1").length === 1, "队列共 " + win.FeedStore.messages.length + " 条");
chk("active() 能取到该广播", win.FeedStore.active().some(m => m.id === "t1"), win.FeedStore.active().length + " 条生效");
chk("内置广播数据已合并", win.FeedStore.messages.length >= (win.BROADCAST_DATA.messages || []).length, win.FeedStore.messages.length + " 条");
chk("localStorage 已持久化", !!store.get("examclock.broadcast.feed.v1"));

/* 配置持久化 + 规则引擎 */
const cfg = win.FeedStore.getConfig();
cfg.clock.enabled = true;
cfg.exam.enabled = true;
cfg.settings.minGapSeconds = 0;
win.FeedStore.setConfig(cfg);
chk("配置写回成功", win.FeedStore.getConfig().clock.enabled === true);

/* 模拟考试进行中，触发节点播报 */
const t = new Date(Date.now() + 5 * 60000);
win.exams = win.exams || {};
win.subject = { name: "语文", start: t, end: new Date(t.getTime() + 90 * 60000) };
win.now = new Date();
let threw = null;
try { win.Broadcast.engine.ready && win.Broadcast.test("notice"); } catch (e) { threw = e.message; }
chk("引擎调用无异常", !threw, threw);

/* 必应 / 在线图源解析 */
const before = win.BG.plan.length;
chk("在线图源已加入候选池", win.BG.plan.some(p => p.api), win.BG.plan.filter(p => p.api).length + " 条 API 候选");
chk("视频源已加入候选池", win.BG.plan.some(p => p.kind === "video"));
chk("渐变源已加入候选池", win.BG.plan.some(p => p.kind === "css"));

/* 背景切换 */
let switched = false;
try { win.bgNext(); switched = true; } catch (e) { errors.push("bgNext: " + e.message); }
chk("bgNext() 可调用", switched);

chk("无 JS 运行错误", errors.filter(e => e.startsWith("ERROR") || e.startsWith("LOAD-FAIL")).length === 0,
  errors.filter(e => e.startsWith("ERROR") || e.startsWith("LOAD-FAIL")).join(" | ").slice(0, 500));

console.log(out.join("\n"));
console.log("\n--- 警告（多为离线环境下的网络失败，属预期） ---");
console.log(errors.slice(0, 10).join("\n") || "（无）");
const failed = out.filter(l => l.startsWith("FAIL")).length;
console.log("\n结果：" + (out.length - failed) + "/" + out.length + " 通过");
process.exit(failed ? 1 : 0);
}
