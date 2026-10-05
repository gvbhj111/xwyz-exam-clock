/*
 * 广播数据源（Feed Store）
 * ------------------------------------------------------------------
 * 广播 / 配置的读写与持久化。全部走前端，静态托管可用：
 *   1. 本地（localStorage）—— 后台发出的广播立即生效，离线可用
 *   2. 静态文件（./data/feed.json.js）—— 仓库提交后所有大屏都能看到
 *   3. 远程 JSON / GitHub API —— 后台配置一次，全校大屏自动同步
 *   4. 同源多窗口 BroadcastChannel —— 同一台电脑多个标签页实时联动
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  var LS = {
    config: "examclock.broadcast.config.v1",
    feed: "examclock.broadcast.feed.v1",
    history: "examclock.broadcast.history.v1",
    remote: "examclock.broadcast.remote.v1",
    seen: "examclock.broadcast.seen.v1"
  };

  var CHANNEL = "examclock-broadcast";

  function $(id) { return document.getElementById(id); }
  function now() { return Date.now(); }

  function readJSON(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function writeJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  }

  function base64DecodeUnicode(str) {
    try {
      return decodeURIComponent(Array.prototype.map.call(atob(str.replace(/\s/g, "")), function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(""));
    } catch (e) { return ""; }
  }

  function normalizeMessage(m) {
    if (!m) return null;
    var text = String(m.text || m.message || m.content || "").trim();
    if (!text) return null;
    var at = m.at || m.time || m.createdAt || "";
    return {
      id: String(m.id || m.uuid || ("m-" + Math.random().toString(36).slice(2, 9))),
      at: at ? new Date(at).toISOString() : "",
      until: m.until ? new Date(m.until).toISOString() : "",
      level: m.level || m.type || "notice",
      text: text,
      voice: m.voice || "",
      announce: m.announce || "",
      pin: !!m.pin,
      source: m.source || "广播中心",
      repeatEveryMinutes: +m.repeatEveryMinutes || 0,
      _remote: !!m._remote
    };
  }

  var Store = {
    config: null,
    messages: [],
    remoteMessages: [],
    remoteUrl: "",
    lastSync: 0,
    channel: null,

    /* ------------------------------------------------------------ 初始化 */
    init: function () {
      var url = new URLSearchParams(location.search);
      this.config = this.mergeConfig(global.BROADCAST_CONFIG || {}, readJSON(LS.config, null));
      this.remoteUrl = url.get("feed") || this.config.feedUrl || readJSON(LS.remote, "") || "";
      this.messages = (readJSON(LS.feed, []) || []).map(normalizeMessage).filter(Boolean);
      var statics = (global.BROADCAST_DATA && global.BROADCAST_DATA.messages) || [];
      statics.forEach(function (m) {
        var n = normalizeMessage(m);
        if (n && !Store.messages.some(function (x) { return x.id === n.id; })) Store.messages.push(n);
      });
      this.messages.sort(function (a, b) { return new Date(a.at || 0) - new Date(b.at || 0); });

      try {
        if (global.BroadcastChannel) {
          this.channel = new BroadcastChannel(CHANNEL);
          var self = this;
          this.channel.onmessage = function (e) {
            if (!e || !e.data) return;
            if (e.data.type === "feed") { self.syncRemote(e.data.messages || []); self.emit(); }
            if (e.data.type === "config") { self.config = self.mergeConfig(global.BROADCAST_CONFIG || {}, e.data.config); self.emit(); }
          };
        }
      } catch (e) { }
      return this;
    },

    mergeConfig: function (base, override) {
      var out = JSON.parse(JSON.stringify(base || {}));
      if (!override) return out;
      Object.keys(override).forEach(function (k) {
        if (override[k] && typeof override[k] === "object" && !Array.isArray(override[k]) && out[k]) {
          Object.keys(override[k]).forEach(function (k2) { out[k][k2] = override[k][k2]; });
        } else out[k] = override[k];
      });
      return out;
    },

    /* -------------------------------------------------------- 配置读写 */
    getConfig: function () { return this.config; },

    setConfig: function (cfg, silent) {
      this.config = this.mergeConfig(global.BROADCAST_CONFIG || {}, cfg);
      if (this.config.feedUrl) { this.remoteUrl = this.config.feedUrl; writeJSON(LS.remote, this.remoteUrl); }
      writeJSON(LS.config, this.config);
      if (!silent) {
        this.emitConfig();
        if (this.channel) { try { this.channel.postMessage({ type: "config", config: this.config }); } catch (e) { } }
      }
    },

    setFeedUrl: function (url) {
      this.remoteUrl = (url || "").trim();
      writeJSON(LS.remote, this.remoteUrl);
      this.config.feedUrl = this.remoteUrl;
      writeJSON(LS.config, this.config);
      return this.remoteUrl;
    },

    getFeedUrl: function () {
      return this.remoteUrl || (this.config && this.config.feedUrl) || "";
    },

    /* ---------------------------------------------------------- 广播列表 */
    list: function () { return this.visible(); },

    visible: function () {
      var t = now();
      return this.messages.concat(this.remoteMessages).filter(function (m) {
        if (m.at && new Date(m.at).getTime() > t + 60000) return false;      // 未来生效
        if (m.until && new Date(m.until).getTime() < t) return false;        // 已过期
        return true;
      }).sort(function (a, b) { return new Date(b.at || 0) - new Date(a.at || 0); });
    },

    active: function () {
      return this.visible().filter(function (m) { return m.pin || !m.until; });
    },

    /* 发送广播（后台 / 控制台 / 其它页面均可调用） */
    send: function (msg, opts) {
      opts = opts || {};
      var m = normalizeMessage(msg);
      if (!m) return null;
      m.at = m.at || new Date().toISOString();
      m.source = m.source || "本机广播";
      // 同 id 覆盖，否则追加
      var idx = this.messages.findIndex(function (x) { return x.id === m.id; });
      if (idx >= 0) this.messages[idx] = m; else this.messages.push(m);
      this._trim();
      writeJSON(LS.feed, this.messages);
      if (!opts.silent) {
        this.emitMessage(m);
        if (this.channel) { try { this.channel.postMessage({ type: "feed", messages: this.messages }); } catch (e) { } }
      }
      return m;
    },

    remove: function (id) {
      this.messages = this.messages.filter(function (m) { return m.id !== id; });
      writeJSON(LS.feed, this.messages);
      this.emit();
      if (this.channel) { try { this.channel.postMessage({ type: "feed", messages: this.messages }); } catch (e) { } }
    },

    clear: function (keepStatic) {
      this.messages = keepStatic ? [] : [];
      writeJSON(LS.feed, this.messages);
      this.emit();
      if (this.channel) { try { this.channel.postMessage({ type: "feed", messages: [] }); } catch (e) { } }
    },

    _trim: function () {
      var limit = +(this.config.settings && this.config.settings.historyLimit) || 120;
      this.messages.sort(function (a, b) { return new Date(a.at || 0) - new Date(b.at || 0); });
      if (this.messages.length > limit) this.messages = this.messages.slice(-limit);
    },

    /* ------------------------------------------------------------ 远程同步 */
    syncRemote: function (messages) {
      this.remoteMessages = (messages || []).map(function (m) {
        var n = normalizeMessage(m); if (n) n._remote = true; return n;
      }).filter(Boolean);
      this.lastSync = now();
    },

    fetchRemote: function () {
      var url = this.getFeedUrl();
      if (!url || !global.fetch) return Promise.resolve(false);
      var self = this;
      var headers = { "Accept": "application/vnd.github+json, application/json" };
      var token = (this.config.ghToken || "").trim();
      if (/api\.github\.com/.test(url) && token) headers["Authorization"] = "Bearer " + token;
      return fetch(url + (url.indexOf("?") >= 0 ? "&" : "?") + "_=" + now(), { cache: "no-store", headers: headers })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (json) {
          if (!json) return false;
          var list = json.messages || (json.content != null ? self._decodeGitHub(json) : (Array.isArray(json) ? json : []));
          self.syncRemote(list);
          self.emit();
          return true;
        })
        .catch(function (e) { console.warn("[broadcast] 远程广播源读取失败：", e.message || e); return false; });
    },

    _decodeGitHub: function (json) {
      try { return JSON.parse(base64DecodeUnicode(json.content)).messages || []; }
      catch (e) { return []; }
    },

    /* 把本地广播推回远程（GitHub Contents API） */
    pushRemote: function () {
      var url = this.getFeedUrl();
      var token = (this.config.ghToken || "").trim();
      if (!url || !token) return Promise.reject(new Error("未配置远程广播源或 Token"));
      var m = /api\.github\.com\/repos\/([^/]+)\/([^/]+)\/contents\/(.+?)(\?|$)/.exec(url);
      if (!m) return Promise.reject(new Error("仅支持 GitHub Contents API 地址"));
      var owner = m[1], repo = m[2], path = decodeURIComponent(m[3]);
      var branch = (this.config.feedBranch || "main");
      var payload = JSON.stringify({ version: "1.0.0", updated: new Date().toISOString(), messages: this.messages }, null, 2);
      var api = "/repos/" + owner + "/" + repo + "/contents/" + path;
      var headers = { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };
      var self = this;
      return fetch("https://api.github.com" + api + "?ref=" + encodeURIComponent(branch), { headers: headers })
        .then(function (r) { return r.status === 200 ? r.json() : null; })
        .then(function (info) {
          var body = { message: "broadcast: " + new Date().toLocaleString(), content: btoa(unescape(encodeURIComponent(payload))), branch: branch };
          if (info && info.sha) body.sha = info.sha;
          return fetch("https://api.github.com" + api, { method: "PUT", headers: headers, body: JSON.stringify(body) });
        })
        .then(function (r) {
          if (!r.ok) throw new Error("推送失败 HTTP " + r.status);
          return r.json();
        });
    },

    /* --------------------------------------------------------- 已播报去重 */
    seen: function (id) { return (readJSON(LS.seen, []) || []).indexOf(id) >= 0; },
    markSeen: function (id) {
      var arr = readJSON(LS.seen, []) || [];
      if (arr.indexOf(id) < 0) { arr.push(id); if (arr.length > 400) arr = arr.slice(-400); writeJSON(LS.seen, arr); }
    },

    /* --------------------------------------------------------- 播报历史 */
    history: function () { return readJSON(LS.history, []) || []; },
    addHistory: function (item) {
      var arr = readJSON(LS.history, []) || [];
      arr.unshift(item);
      arr = arr.slice(0, 300);
      writeJSON(LS.history, arr);
      this.emit("history", arr);
      return arr;
    },
    clearHistory: function () { writeJSON(LS.history, []); this.emit("history", []); },

    /* ------------------------------------------------------------ 事件 */
    _listeners: [],
    on: function (fn) { this._listeners.push(fn); return fn; },
    off: function (fn) { this._listeners = this._listeners.filter(function (f) { return f !== fn; }); },
    emitMessage: function (m) { this._fire({ type: "message", message: m }); },
    emitConfig: function () { this._fire({ type: "config", config: this.config }); },
    emit: function (kind, payload) { this._fire({ type: kind || "feed", messages: this.visible(), history: this.history() }); },
    _fire: function (evt) {
      this._listeners.forEach(function (fn) {
        try { fn(evt); } catch (e) { console.error("[broadcast] 监听器异常", e); }
      });
    },

    /* ------------------------------------------------------------ 轮询 */
    startPolling: function () {
      var self = this;
      if (this._poll) clearInterval(this._poll);
      var sec = +(this.config.settings && this.config.settings.pollSeconds) || 15;
      this._poll = setInterval(function () {
        if (document.hidden) return;
        self.fetchRemote();
      }, Math.max(5, sec) * 1000);
      this.fetchRemote();
      return this._poll;
    }
  };

  global.FeedStore = Store;
})(window);
