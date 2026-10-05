/*
 * 轻量 DOM 桩：让 background.js / broadcast.js / admin.js 能在 Node 里跑起来做自检。
 * 只实现被测代码真正用到的 DOM 子集，不追求完整规范实现。
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class El {
  constructor(tag) {
    this.tagName = String(tag || "div").toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._id = "";
    this.__register = null;
    this.attributes = {};
    this.dataset = {};
    this._text = "";
    this._html = "";
    this.value = "";
    this.checked = false;
    this.type = "";
    this.files = null;
    this._rows = [];
    this._styleProps = {};
    this.classList = {
      _s: new Set(),
      add: (...c) => c.forEach(x => this.classList._s.add(x)),
      remove: (...c) => c.forEach(x => this.classList._s.delete(x)),
      contains: (c) => this.classList._s.has(c),
      toggle: (c, on) => { if (on === undefined) { this.classList._s.has(c) ? this.classList._s.delete(c) : this.classList._s.add(c); } else if (on) this.classList._s.add(c); else this.classList._s.delete(c); }
    };
    const self = this;
    this.style = new Proxy({}, {
      set: (t, k, v) => { t[k] = v; return true; },
      get: (t, k) => {
        if (k === "setProperty") return (n, v) => { self._styleProps[n] = v; };
        if (k === "getPropertyValue") return (n) => self._styleProps[n] || "";
        if (k === "removeProperty") return (n) => { delete self._styleProps[n]; };
        return t[k] === undefined ? "" : t[k];
      }
    });
  }
  get className() { return Array.from(this.classList._s).join(" "); }
  set className(v) { this.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get id() { return this._id || this.attributes.id || ""; }
  set id(v) { this._id = String(v); this.attributes.id = String(v); if (this.__register) this.__register(String(v), this); }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this._text; }
  set textContent(v) {
    this._text = String(v == null ? "" : v);
    if (["TABLE", "TBODY", "THEAD", "TR"].indexOf(this.tagName) < 0) this._html = this._text;
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = String(v == null ? "" : v);
    // 只摘掉真正挂在这棵树上的旧子节点（解析出来的"影子"元素本来就未挂载）
    const drop = (node) => {
      if (!node.parentNode) return;
      (node.children || []).forEach(drop);
      if (node.__register && node.id) {
        const cur = this.__doc && this.__doc._byId.get(node.id);
        if (cur === node) this.__doc._byId.delete(node.id);
      }
      node.parentNode = null;
    };
    this.children.forEach(drop);
    this.children = [];
    this._rows = [];
    const rows = this._html.match(/<tr[\s>]/gi);
    if (rows) this._rows = new Array(rows.length).fill(0);
    // 把 HTML 串里带 id / data-* 的元素也解析成节点，便于自检脚本查找
    if (this.__doc) this.__doc.__parseInto(this, this._html);
  }
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
  click() { if (typeof this.onclick === "function") this.onclick({ target: this }); }
  get offsetWidth() { return 1920; }
  get offsetHeight() { return 1080; }
  focus() { }
  select() { }
  load() { }
  play() { return Promise.resolve(); }
  scrollTop() { return 0; }
}

function makeEnv(opts) {
  opts = opts || {};
  const errors = [];
  const timers = [];
  let seq = 1;
  const store = new Map();
  const byId = new Map();
  const allEls = [];

  const doc = {
    readyState: "loading",
    hidden: false,
    documentElement: new El("html"),
    head: new El("head"),
    body: new El("body"),
    createElement: (t) => {
      const e = new El(t);
      e.__doc = doc;
      e.__register = (id, el) => byId.set(id, el);
      allEls.push(e);
      return e;
    },
    getElementById: (id) => byId.get(id) || null,
    addEventListener: (ev, fn) => { (doc._listeners[ev] = doc._listeners[ev] || []).push(fn); },
    removeEventListener: () => { },
    querySelector: () => null,
    querySelectorAll: () => [],
    write() { },
    _listeners: {},
    _register: (id, tag) => {
      const e = new El(tag || "div");
      e.__doc = doc;
      e.__register = (i, el) => byId.set(i, el);
      e.id = id;
      allEls.push(e);
      doc.body.appendChild(e);
      return e;
    },
    _allByAttr: (attr, val) => live().filter(e => e.getAttribute(attr) === val),
    _byId: byId,
    _all: allEls,
    dispatch: (ev) => (doc._listeners[ev] || []).forEach(fn => fn({}))
  };
  doc.documentElement.__register = (i, el) => byId.set(i, el);

  /* 只把真正挂到文档树上的元素算作"存在"（解析出来的影子元素不算） */
  /* 元素级选择器：支持 [attr] / [attr=value]，在当前子树内查找 */
  El.prototype.querySelectorAll = function (sel) {
    const self = this;
    const out = [];
    const walk = (node) => {
      (node.children || []).forEach((c) => {
        if (matchSel(c, sel)) out.push(c);
        walk(c);
      });
    };
    walk(self);
    return out;
  };
  function matchSel(e, sel) {
    // 支持 tag、.class、[attr]、[attr=value] 以及它们的组合
    const m = /^([a-zA-Z][\w-]*)?(\.[\w-]+)?\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(sel);
    if (m) {
      if (m[1] && e.tagName !== m[1].toUpperCase()) return false;
      if (m[2] && !e.classList.contains(m[2].slice(1))) return false;
      if (m[4] === undefined) return e.getAttribute(m[3]) != null;
      return e.getAttribute(m[3]) === m[4];
    }
    const m2 = /^([a-zA-Z][\w-]*)$/.exec(sel);
    if (m2) return e.tagName === m2[1].toUpperCase();
    return false;
  }

  const attached = (e) => {
    let cur = e;
    while (cur) {
      if (cur === doc.documentElement || cur === doc.body || cur === doc.head) return true;
      cur = cur.parentNode;
    }
    return false;
  };
  const live = () => allEls.filter(attached);
  doc._live = live;

  doc.head.parentNode = doc.documentElement;
  doc.body.parentNode = doc.documentElement;

  doc.querySelectorAll = (sel) => {
    if (sel === "footer p:last-child") return [];
    // 管理后台通过选择器批量绑定/读取事件元素
    if (/^#tabs a$/.test(sel)) return live().filter(e => e.getAttribute("data-tab"));
    if (/^\.tabpane$/.test(sel)) return live().filter(e => e.getAttribute("data-pane"));
    if (/^a\[data-i\]$/.test(sel)) return live().filter(e => e.getAttribute("data-i") != null);
    if (/^button$/.test(sel)) return live().filter(e => e.tagName === "BUTTON");
    if (/input\[type=checkbox\]$/.test(sel)) return live().filter(e => e.tagName === "INPUT" && e.type === "checkbox" && e.checked);
    const mAttr = /\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/.exec(sel);
    if (mAttr) return live().filter(e => e.getAttribute(mAttr[1]) === (mAttr[2] === undefined ? "" : mAttr[2]));
    return [];
  };

  (opts.ids || []).forEach(id => doc._register(id));
  // 一些脚本需要按属性查找的节点（例如后台的 data-tab 导航按钮）
  (opts.attrs || []).forEach(a => {
    const e = doc._register(a.id, a.tag || "a");
    e.setAttribute(a.attr, a.val);
    if (a.text != null) e.textContent = a.text;
  });

  // 解析 HTML 串中的元素（只处理属性，不建文本节点），用于自检脚本按选择器查找
  doc.__parseInto = (parent, html) => {
    const re = /<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      const tag = m[1].toLowerCase();
      if (["br", "img", "hr", "meta", "link"].indexOf(tag) >= 0) continue;
      const e = doc.createElement(tag);
      const attrRe = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let a;
      while ((a = attrRe.exec(m[2] || "")) !== null) {
        const name = a[1];
        const val = a[2] != null ? a[2] : a[3] != null ? a[3] : a[4] != null ? a[4] : "";
        e.setAttribute(name, val);
        if (name === "id") e.id = val;
        if (name === "type") e.type = val;
        if (name === "checked") e.checked = true;
        if (name === "value") e.value = val;
      }
      parent.appendChild(e);
    }
    return parent.children.length;
  };

  // 表格类元素补一个 tbody，并统计行数（真实 DOM 里由 HTML 解析器生成）
  (opts.rows || []).forEach(id => {
    const t = doc._register(id);
    const tb = new El("tbody");
    t.querySelector = (sel) => (sel === "tbody" ? tb : null);
    t.querySelectorAll = () => [];
    t.__tb = tb;
    t.appendChild(tb);
    doc.body.appendChild(t);
  });

  // 页面初始状态
  Object.assign(doc.getElementById("adminPanel") ? doc.getElementById("adminPanel").style : {}, { display: "none" });
  if (opts.display) Object.keys(opts.display).forEach(k => {
    const e = doc.getElementById(k);
    if (e) e.style.display = opts.display[k];
  });

  const sandbox = {
    console: {
      log() { }, info() { }, warn: (...a) => errors.push("WARN " + a.join(" ")),
      error: (...a) => errors.push("ERROR " + a.join(" ")),
      group() { }, groupEnd() { }, groupCollapsed() { }, table() { }, debug() { }
    },
    document: doc,
    location: { search: "", href: "https://example.com/admin.html", protocol: "https:", host: "example.com" },
    navigator: { userAgent: "node-check", clipboard: null },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear()
    },
    sessionStorage: { getItem: () => null, setItem() { }, removeItem() { } },
    setTimeout: (fn, ms) => { const id = seq++; timers.push({ id, fn, ms }); return id; },
    clearTimeout: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    setInterval: (fn, ms) => { const id = seq++; timers.push({ id, fn, ms, interval: true }); return id; },
    clearInterval: (id) => { const i = timers.findIndex(t => t.id === id); if (i >= 0) timers.splice(i, 1); },
    requestAnimationFrame: (fn) => { const id = seq++; timers.push({ id, fn, ms: 16 }); return id; },
    URLSearchParams,
    URL: {
      createObjectURL: () => "blob:fake",
      revokeObjectURL: () => { }
    },
    Blob: class { constructor(parts) { this.size = (parts || []).join("").length; } },
    FileReader: class {
      readAsText(file, enc) {
        setTimeout(() => {
          try { this.onload && this.onload({ target: { result: file.__content || "" } }); }
          catch (e) { this.onerror && this.onerror(e); }
        }, 1);
      }
    },
    fetch: opts.fetch || (() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve("") })),
    Image: class {
      constructor() { this.onload = null; this.onerror = null; }
      set src(v) { this._src = v; setTimeout(() => this.onload && this.onload(), 1); }
      get src() { return this._src; }
    },
    SpeechSynthesisUtterance: class { constructor(t) { this.text = t; } },
    speechSynthesis: {
      getVoices: () => [{ name: "Microsoft Huihui", lang: "zh-CN" }, { name: "Xiaoxiao", lang: "zh-CN" }],
      speak() { }, cancel() { }, onvoiceschanged: null
    },
    Notification: undefined,
    BroadcastChannel: undefined,
    AudioContext: undefined,
    btoa: (s) => Buffer.from(s, "binary").toString("base64"),
    atob: (s) => Buffer.from(s, "base64").toString("binary"),
    TextEncoder,
    TextDecoder,
    crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = i % 251; return a; }, subtle: {} },
    prompt: () => null,
    confirm: () => true,
    alert: () => { },
    Promise, JSON, Math, Date, Object, Array, String, Number, Boolean, RegExp, Error, isNaN,
    parseInt, parseFloat, encodeURIComponent, decodeURIComponent, escape, unescape,
    Symbol, Map, Set, Proxy, Reflect, Intl, WeakMap, Function, URLSearchParams
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  const ctx = vm.createContext(sandbox);

  // 预置文件内容，供 fetch 桩使用（只对 GET 生效，写操作交给 opts.fetch）
  const files = opts.files || {};
  const baseFetch = opts.fetch || (() => Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve("") }));
  sandbox.fetch = (url, init) => {
    if (init && init.method && init.method !== "GET") return baseFetch(url, init);
    const key = String(url).replace(/^\.\//, "").split("?")[0];
    if (key in files) {
      return Promise.resolve({
        ok: true, status: 200,
        text: () => Promise.resolve(files[key]),
        json: () => Promise.resolve(JSON.parse(files[key]))
      });
    }
    return baseFetch(url, init);
  };

  return { doc, sandbox, ctx, errors, timers, store, El, root: opts.root || process.cwd() };
}

/* 把多个脚本拼成一包加载（模拟浏览器共享全局作用域），最后触发 DOMContentLoaded */
function loadFiles(env, list, rootDir) {
  const root = rootDir || path.join(__dirname, "..");
  const code = list.map(f => "\n/*=== " + f + " ===*/\n" + fs.readFileSync(path.join(root, f), "utf8")).join("\n");
  try {
    vm.runInContext(code, env.ctx, { filename: "bundle" });
  } catch (e) {
    env.errors.push("ERROR load: " + e.message);
    return { ok: false, error: e.message + "\n" + (e.stack || "").split("\n").slice(0, 3).join("\n") };
  }
  // 模拟解析完成后触发 DOMContentLoaded
  env.doc.readyState = "complete";
  try {
    vm.runInContext("if (typeof document!=='undefined' && document.dispatchEvent) document.dispatchEvent('DOMContentLoaded');", env.ctx);
    env.doc.dispatch("DOMContentLoaded");
  } catch (e) { env.errors.push("ERROR dcl: " + e.message); }
  return { ok: true };
}

module.exports = { makeEnv, loadFiles, El };
