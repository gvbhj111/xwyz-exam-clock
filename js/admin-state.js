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
    gh: {
      owner: "gvbhj111", repo: "xwyz-exam-clock", branch: "main",
      message: "chore(admin): update exam clock data",
      feedPath: "data/feed.json", token: ""
    },
    editingSourceId: null
  };

  /* ------------------------------------------------------------ 载入 */
  function load() {
    // 背景：以脚本文件里的定义为基线，用本机修改覆盖；
    // 关键：本机没有、但文件里有的来源要补回来，
    // 否则"发布"会把新增的内置来源（必应/视频等）覆盖丢失。
    var base = global.BG_DATA || { settings: {}, items: [] };
    var localBg = U.lsGet(LS.bg, null);
    var localItems = (localBg && localBg.items) || null;
    var merged = U.deepCopy(base.items || []);
    if (localItems) {
      localItems.forEach(function (li) {
        var idx = merged.findIndex(function (b) { return b.id === li.id; });
        if (idx >= 0) merged[idx] = U.merge(merged[idx], li);
        else merged.push(li);           // 你新增的来源
      });
    }
    State.bg = { settings: U.merge(base.settings, localBg && localBg.settings), items: merged };
    // 补全内置来源的动态字段
    State.bg.items.forEach(function (it) {
      var src = (base.items || []).filter(function (b) { return b.id === it.id; })[0];
      if (src && src.api) {
        if (!it.api) it.api = src.api;
        if (src.topics && !it.topics) it.topics = src.topics;
        if (src.suffix != null && it.suffix == null) it.suffix = src.suffix;
        if (src.base && !it.base) it.base = src.base;
        if (src.fallback && !(it.fallback && it.fallback.length)) it.fallback = src.fallback;
        if (src.list && src.list.length && !(it.list && it.list.length)) it.list = src.list;
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

  /* 把 GitHub 返回的错误体解析成人能看懂的提示 */
  function parseGitHubError(status, text) {
    var msg = "";
    try {
      var j = JSON.parse(text || "{}");
      msg = j.message || "";
      if (j.errors && j.errors.length) {
        msg += "；" + j.errors.map(function (e) { return e.message || e.code || JSON.stringify(e); }).join("；");
      }
    } catch (e) { msg = String(text || "").slice(0, 200); }
    if (status === 401) {
      return "Token 无效或已过期（401 " + msg + "）· 请在 GitHub → Settings → Developer settings 重新生成" +
        "（Classic 勾选 repo；Fine-grained 选本仓库并把 Contents 设为 Read and write，注意有效期）";
    }
    if (status === 403) {
      if (/rate limit/i.test(msg)) return "触发 GitHub 限流（403），等几分钟再试";
      return "权限不足（403 " + msg + "）· Token 需要本仓库的 Contents 写权限";
    }
    if (status === 404) return "仓库或路径不存在，或 Token 无权访问该仓库（404 " + msg + "）· 检查所有者/仓库名/分支";
    if (status === 409) return "分支冲突（409）：远端文件刚被改过，请刷新后重试";
    if (status === 422) return "提交被拒绝（422 " + msg + "）";
    return "HTTP " + status + (msg ? " " + msg : "");
  }

  /*
   * Token 体检：报告"这个 Token 是谁、能不能读仓库、能不能写内容"。
   * 发布前跑一次，避免提交到一半才发现 401。
   */
  function checkToken() {
    var gh = State.gh;
    return resolveToken().then(function (token) {
      if (!token) return { ok: false, reason: "还没有填写 GitHub Token" };
      var base = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
      var authed = Object.assign({}, base, { "Authorization": "Bearer " + token });
      var report = { ok: false, user: "", scopes: "", repoAccess: "", canWrite: "" };
      return fetch("https://api.github.com/user", { headers: authed })
        .then(function (r) {
          report.scopes = r.headers.get ? (r.headers.get("x-oauth-scopes") || "") : "";
          if (r.status === 401) return r.text().then(function (t) { throw new Error(parseGitHubError(401, t)); });
          if (!r.ok) return r.text().then(function (t) { throw new Error(parseGitHubError(r.status, t)); });
          return r.json();
        })
        .then(function (u) {
          report.user = (u && u.login) || "（未知）";
          return fetch("https://api.github.com/repos/" + gh.owner + "/" + gh.repo, { headers: authed });
        })
        .then(function (r) {
          if (r.status === 404) {
            report.repoAccess = "读不到（404）：仓库名写错，或 Token 未授权该仓库";
            report.ok = false;
            report.reason = report.repoAccess;
            return report;
          }
          if (!r.ok) return r.text().then(function (t) { throw new Error(parseGitHubError(r.status, t)); });
          return r.json();
        })
        .then(function (repo) {
          if (repo && repo.permissions) {
            report.canWrite = repo.permissions.push ? "可写（push 权限已授予）" : "只读（没有 push 权限，发布会被拒）";
          } else {
            report.canWrite = "未知（需要 Contents 写权限）";
          }
          report.defaultBranch = repo && repo.default_branch;
          report.ok = /可写/.test(report.canWrite);
          if (!report.ok) {
            report.reason = report.canWrite === "未知（需要 Contents 写权限）"
              ? "Token 权限信息未知，但可以尝试发布；若报 403/401 请给 Contents 写权限"
              : report.canWrite;
          }
          report.ownerMatch = /^gvbhj111$/i.test(report.user);
          return report;
        })
        .catch(function (e) { return { ok: false, reason: e.message, user: report.user, scopes: report.scopes }; });
    });
  }

  /* 统一的请求头 */
  function headers(token) {
    var h = { "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  function pushFile(path, content, message) {
    var gh = State.gh;
    return resolveToken().then(function (token) {
      if (!token) throw new Error("未提供 GitHub Token");
      var api = "https://api.github.com/repos/" + gh.owner + "/" + gh.repo + "/contents/" + encodeURIComponent(path).replace(/%2F/g, "/");
      var h = headers(token);
      h["Content-Type"] = "application/json";
      return fetch(api + "?ref=" + encodeURIComponent(gh.branch), { headers: h })
        .then(function (r) {
          if (r.status === 200) return r.json();
          if (r.status === 404) return null;                 // 远端还没有这个文件
          return r.text().then(function (t) { throw new Error(parseGitHubError(r.status, t)); });
        })
        .then(function (info) {
          var body = { message: message || gh.message, content: b64(content), branch: gh.branch };
          if (info && info.sha) body.sha = info.sha;
          return fetch(api, { method: "PUT", headers: h, body: JSON.stringify(body) });
        })
        .then(function (r) {
          if (!r.ok) return r.text().then(function (t) { throw new Error(parseGitHubError(r.status, t)); });
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
    resolveToken: resolveToken,
    checkToken: checkToken,
    parseGitHubError: parseGitHubError
  };
})(window);
