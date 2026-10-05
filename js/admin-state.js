/*
 * 管理控制台 · 状态与数据生成
 * ------------------------------------------------------------------
 * 所有内容都保存在浏览器本地（localStorage），
 * "发布"时再生成对应的静态文件提交到仓库。
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";
  var U = global.AdminUtil;
  var $ = U.$;

  var LS = {
    state: "examclock.admin.v1",
    bg: "examclock.bg.v1",
    br: "examclock.broadcast.config.v1"
  };

  /* ------------------------------------------------------------ 默认外观 */
  var DEFAULT_THEME = {
    slogan: "考试时钟",
    school: "宣威一中",
    version: "V 8.0.0 背景轮播 + 考试广播",
    accent: "#7aaeff",
    darken: 50,
    tip: "按 F11 或点击右上角图标可全屏"
  };

  /* ------------------------------------------------------------ 状态 */
  var State = {
    logged: false,
    tab: "dash",
    bg: null,        // 背景配置（BG_DATA 结构）
    br: null,        // 广播配置（BROADCAST_CONFIG 结构）
    theme: null,
    examSource: null,
    examTypes: null,
    draftMuted: null,
    dirty: {},
    gh: { owner: "gvbhj111", repo: "xwyz-exam-clock", branch: "main", message: "chore(admin): update exam clock data", token: "" },
    editingSourceId: null
  };

  /* ------------------------------------------------------------ 载入 */
  function load() {
    // 背景
    var base = global.BG_DATA || { settings: {}, items: [] };
    var localBg = U.lsGet(LS.bg, null);
    State.bg = { settings: U.merge(base.settings, localBg && localBg.settings), items: (localBg && localBg.items) || U.deepCopy(base.items) };
    // 补全内置来源的动态字段
    State.bg.items.forEach(function (it) {
      var src = (base.items || []).filter(function (b) { return b.id === it.id; })[0];
      if (src && src.api) {
        if (!it.api) it.api = src.api;
        if (src.topics && !it.topics) it.topics = src.topics;
        if (src.suffix != null && it.suffix == null) it.suffix = src.suffix;
        if (src.base && !it.base) it.base = src.base;
      }
      if (it.enabled == null) it.enabled = true;
    });

    // 广播
    var brBase = global.BROADCAST_CONFIG || { settings: {}, exam: {}, clock: {}, discipline: {}, timeSync: {} };
    var localBr = U.lsGet(LS.br, null);
    State.br = U.merge(brBase, localBr || {});

    // 外观 + 仓库 + 登录态
    var s = U.lsGet(LS.state, {}) || {};
    State.theme = U.merge(DEFAULT_THEME, s.theme || {});
    State.gh = U.merge(State.gh, s.gh || {});
    State.dirty = s.dirty || {};
    State.tab = s.tab || "dash";
    State.logged = !!s.logged;
    return State;
  }

  function save() {
    U.lsSet(LS.bg, { settings: State.bg.settings, items: State.bg.items });
    U.lsSet(LS.br, State.br);
    U.lsSet(LS.state, { theme: State.theme, gh: State.gh, dirty: State.dirty, tab: State.tab, logged: State.logged });
  }

  function markDirty(file) { State.dirty[file] = true; save(); }

  /* ------------------------------------------------------------ 文件生成 */
  function jsHeader(title, note) {
    return "/*\n * " + title + "\n" +
      " * 由考试时钟管理控制台生成 · " + new Date().toLocaleString() + "\n" +
      (note ? " * " + note + "\n" : "") +
      " */\n";
  }

  function buildBgData() {
    var cfg = U.deepCopy(State.bg);
    cfg.updated = new Date().toISOString().slice(0, 10);
    var src = jsHeader("背景数据源配置（Background Data）", "后台可视化编辑生成，可直接手工修改。") +
      "window.BG_DATA = " + JSON.stringify(cfg, null, 2) + ";\n";
    return src;
  }

  function buildBroadcastData() {
    var b = U.deepCopy(State.br);
    var src = jsHeader("考试广播配置（Broadcast Rules）", "后台可视化编辑生成，可直接手工修改。") +
      "window.BROADCAST_CONFIG = " + JSON.stringify(b, null, 2) + ";\n";
    return src;
  }

  function buildFeed() {
    var list = (global.FeedStore && global.FeedStore.messages) || [];
    var payload = {
      version: "1.0.0",
      updated: new Date().toISOString(),
      messages: list
    };
    return jsHeader("广播数据（Exam Broadcast Feed）", "由管理控制台生成，勿手工改 id。") +
      "window.BROADCAST_DATA = " + JSON.stringify(payload, null, 2) + ";\n";
  }

  function buildFeedJson() {
    var list = (global.FeedStore && global.FeedStore.messages) || [];
    return JSON.stringify({ version: "1.0.0", updated: new Date().toISOString(), messages: list }, null, 2) + "\n";
  }

  function buildSiteData() {
    var t = U.deepCopy(State.theme);
    return jsHeader("站点外观配置（Site Theme）", "后台可视化编辑生成。") +
      "window.SITE_DATA = " + JSON.stringify({ version: "1.0.0", theme: t }, null, 2) + ";\n";
  }

  function buildExamFile() {
    return State.examSource || "";
  }

  /* ------------------------------------------------------------ 文件清单 */
  var FILES = [
    { file: "js/bg-data.js", name: "背景数据", key: "bg", desc: "背景来源 / 轮播参数 / 自定义图片", build: buildBgData },
    { file: "js/broadcast-data.js", name: "广播规则", key: "br", desc: "语音设置 / 考试节点 / 报时 / 纪律", build: buildBroadcastData },
    { file: "data/feed.json.js", name: "广播数据(JS)", key: "feed", desc: "当前广播队列（主站直接加载）", build: buildFeed },
    { file: "data/feed.json", name: "广播数据(JSON)", key: "feed", desc: "供远程广播源 / 多屏同步使用", build: buildFeedJson },
    { file: "js/site-data.js", name: "站点外观", key: "theme", desc: "标题 / 主题色 / 遮罩深度", build: buildSiteData },
    { file: "js/exam.js", name: "考试数据", key: "exam", desc: "各年级考试科目与时间", build: buildExamFile, needsEdit: true }
  ];

  function buildOne(item) {
    try { return item.build(); }
    catch (e) { U.toast("生成 " + item.file + " 失败：" + e.message, "err"); throw e; }
  }

  /* ------------------------------------------------------------ 发布 */
  function b64(str) { return U.b64(str); }

  function resolveToken() {
    var form = document.getElementById("ghToken");
    var typed = form && form.value ? String(form.value).trim() : "";
    if (typed) return Promise.resolve(typed);
    if (State.gh.token) return Promise.resolve(State.gh.token);
    var enc = U.lsGet(U.C.LS_TOKEN, null);
    var passEl = document.getElementById("ghPass");
    var pass = passEl ? passEl.value : "";
    if (!enc) return Promise.resolve("");
    if (!pass) return Promise.resolve("");
    return U.decryptToken(enc, pass).then(function (t) { return t; }).catch(function () { return ""; });
  }

  function pushFile(path, content, message) {
    var gh = State.gh;
    return resolveToken().then(function (token) {
      if (!token) throw new Error("未提供 GitHub Token");
      var api = "https://api.github.com/repos/" + gh.owner + "/" + gh.repo + "/contents/" + encodeURIComponent(path).replace(/%2F/g, "/");
      var headers = { "Authorization": "Bearer " + token, "Accept": "application/vnd.github+json", "Content-Type": "application/json" };
      return fetch(api + "?ref=" + encodeURIComponent(gh.branch), { headers: headers })
        .then(function (r) { return r.status === 200 ? r.json() : (r.status === 404 ? null : Promise.reject(new Error("读取失败 HTTP " + r.status))); })
        .then(function (info) {
          var body = { message: message || gh.message, content: b64(content), branch: gh.branch };
          if (info && info.sha) body.sha = info.sha;
          return fetch(api, { method: "PUT", headers: headers, body: JSON.stringify(body) });
        })
        .then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error("推送失败 HTTP " + r.status + " " + t.slice(0, 200)); });
          return r.json();
        })
        .then(function (j) {
          State.dirty[path] = false;
          save();
          return j && j.commit && j.commit.sha ? j.commit.sha : "ok";
        });
    });
  }

  global.AdminState = {
    LS: LS,
    DEFAULT_THEME: DEFAULT_THEME,
    FILES: FILES,
    state: State,
    load: load,
    save: save,
    markDirty: markDirty,
    buildOne: buildOne,
    buildBgData: buildBgData,
    buildBroadcastData: buildBroadcastData,
    buildFeed: buildFeed,
    buildFeedJson: buildFeedJson,
    buildSiteData: buildSiteData,
    pushFile: pushFile,
    resolveToken: resolveToken
  };
})(window);
