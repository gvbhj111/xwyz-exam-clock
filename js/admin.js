/*
 * 管理控制台 · 主逻辑（登录 / 标签页 / 事件绑定 / 发布）
 * ------------------------------------------------------------------
 * 纯前端页面：没有后端、没有数据库，
 * 所有数据保存在浏览器本地，"发布"时生成静态文件提交到仓库。
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";
  var U = global.AdminUtil;
  var St = global.AdminState;
  var UI = global.AdminUI;
  var $ = U.$, $$ = U.$$;

  /* 默认账号（可自行修改；纯前端静态页面的定位是"防误操作"，不是安全边界） */
  var USER = "gvbhj111";
  var PASS = "667755asd";

  var currentCaptcha = null;

  /* ------------------------------------------------------------ 日志 */
  function log(msg) {
    var s = $("status");
    if (s) {
      s.textContent += "[" + new Date().toLocaleTimeString() + "] " + msg + "\n";
      s.scrollTop = s.scrollHeight;
    }
    console.log("[Admin]", msg);
    var fs = $("footStat");
    if (fs) fs.textContent = String(msg).slice(0, 80);
  }
  global.AdminLog = log;

  /* ------------------------------------------------------------ 安全绑定 */
  /* 页面上缺少某个控件时，其它功能不受影响 */
  function on(id, event, handler) {
    var el = $(id);
    if (!el) return null;
    el[event] = handler;
    return el;
  }

  /* ------------------------------------------------------------ 登录 */
  function newCaptcha() {
    var a = Math.floor(Math.random() * 9) + 1;
    var b = Math.floor(Math.random() * 9) + 1;
    var op = ["+", "-", "×"][Math.floor(Math.random() * 3)];
    var ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
    currentCaptcha = { a: a, b: b, op: op, ans: ans };
    var input = $("localCaptcha");
    if (input) {
      input.value = "";
      input.placeholder = "计算：" + a + " " + op + " " + b + " = ?";
    }
    return currentCaptcha;
  }

  function doLogin() {
    var u = $("adminUser") ? $("adminUser").value.trim() : "";
    var p = $("adminPass") ? $("adminPass").value : "";
    var cap = $("localCaptcha") ? $("localCaptcha").value.trim() : "";
    if (!cap || !currentCaptcha || parseFloat(cap) !== currentCaptcha.ans) {
      newCaptcha();
      if ($("loginMsg")) $("loginMsg").innerHTML = '<span class="err">验证码不正确，已换一题</span>';
      return;
    }
    if (u !== USER || p !== PASS) {
      newCaptcha();
      if ($("loginMsg")) $("loginMsg").innerHTML = '<span class="err">账号或密码错误</span>';
      return;
    }
    St.state.logged = true;
    St.save();
    enterConsole();
  }

  function enterConsole() {
    if ($("loginPanel")) $("loginPanel").style.display = "none";
    if ($("adminPanel")) $("adminPanel").style.display = "";
    log("登录成功，欢迎回来");
    boot();
  }

  function logout() {
    St.state.logged = false;
    St.save();
    location.reload();
  }

  /* ------------------------------------------------------------ 标签页 */
  function switchTab(name) {
    St.state.tab = name;
    St.save();
    $$("#tabs a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-tab") === name);
    });
    $$(".tabpane").forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-pane") === name);
    });
    if (name === "dash") UI.renderDash();
    if (name === "bg") UI.renderBg();
    if (name === "broadcast") UI.renderBroadcast();
    if (name === "rules") UI.renderRules();
    if (name === "theme") UI.renderTheme();
    if (name === "publish") UI.renderPublish();
  }

  /* ------------------------------------------------------------ 启动 */
  function boot() {
    switchTab(St.state.tab || "dash");
    UI.renderDash();
    if (!St.state.examSource) UI.loadExamText();
    else {
      if ($("examEditor")) $("examEditor").value = St.state.examSource;
      if (St.state.examTypes) UI.renderExamTable(St.state.examTypes);
    }
    if (global.speechSynthesis) {
      global.speechSynthesis.onvoiceschanged = function () { UI.fillVoices(St.state.br.settings.voiceName); };
      UI.fillVoices(St.state.br.settings.voiceName);
    }
  }

  /* ------------------------------------------------------------ 事件绑定 */
  function bind() {
    on("loginBtn", "onclick", doLogin);
    on("captchaRefresh", "onclick", newCaptcha);
    if ($("localCaptcha")) $("localCaptcha").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    if ($("adminPass")) $("adminPass").addEventListener("keydown", function (e) { if (e.key === "Enter") doLogin(); });
    on("logoutBtn", "onclick", logout);
    on("quickPush", "onclick", function () {
      publish(["js/bg-data.js", "js/broadcast-data.js", "data/feed.json.js", "data/feed.json", "js/site-data.js"]);
    });
    on("quickPushFeed", "onclick", function () { publish(["data/feed.json.js", "data/feed.json"]); });

    $$("#tabs a").forEach(function (a) {
      a.onclick = function () { switchTab(a.getAttribute("data-tab")); };
    });

    /* ---- 背景轮播设置 ---- */
    var bgFields = {
      bgEnabled: ["enabled", function (v) { return v === "1"; }],
      bgInterval: ["intervalSeconds", Number],
      bgOrder: ["order", String],
      bgTransitionMs: ["transitionMs", Number],
      bgEffect: ["effect", String],
      bgDarken: ["darken", Number],
      bgKenBurns: ["kenBurns", function (v) { return v === "1"; }],
      bgShowCaption: ["showCaption", function (v) { return v === "1"; }]
    };
    Object.keys(bgFields).forEach(function (id) {
      on(id, "onchange", function () {
        var f = bgFields[id];
        St.state.bg.settings[f[0]] = f[1]($(id).value);
        St.save();
        St.markDirty("js/bg-data.js");
        log("背景设置：" + f[0] + " = " + St.state.bg.settings[f[0]]);
      });
    });

    on("bgAddSource", "onclick", UI.addSource);
    on("bgAddUrl", "onclick", function () {
      U.modal({
        title: "添加图片 URL",
        html: '<label>图片地址（每行一个）<textarea id="mUrls" rows="4" placeholder="https://..."></textarea></label>' +
          '<label>来源名称<input type="text" id="mName" value="图床链接"></label>',
        onOk: function () {
          var urls = $("mUrls").value.split(/\s*\n\s*/).filter(Boolean);
          if (!urls.length) { U.toast("请填写地址", "err"); return null; }
          var name = $("mName").value.trim() || "图床链接";
          var item = St.state.bg.items.filter(function (i) { return i.id === "user-url"; })[0];
          if (!item) {
            item = { id: "user-url", type: "custom", name: name, weight: 3, enabled: true, list: [] };
            St.state.bg.items.push(item);
          }
          urls.forEach(function (u) { item.list.push({ author: "自定义", name: "URL " + (item.list.length + 1), url: u }); });
          St.state.editingSourceId = item.id;
          St.save(); St.markDirty("js/bg-data.js");
          UI.renderBg();
          U.toast("已添加 " + urls.length + " 个地址");
          return true;
        }
      });
    });
    on("bgAddLocal", "onclick", function () {
      U.modal({
        title: "登记仓库内的本地图片",
        html: '<p class="dim">把图片放进仓库（例如 <code>./images/</code> 目录）后，在这里登记相对路径即可，换域名也不会失效。</p>' +
          '<label>相对路径（每行一个）<textarea id="mUrls" rows="4" placeholder="./images/1.jpg&#10;./images/2.jpg"></textarea></label>',
        onOk: function () {
          var urls = $("mUrls").value.split(/\s*\n\s*/).filter(Boolean);
          if (!urls.length) { U.toast("请填写路径", "err"); return null; }
          var item = St.state.bg.items.filter(function (i) { return i.id === "local-repo"; })[0];
          if (!item) {
            item = { id: "local-repo", type: "local", name: "仓库图片（./images/）", weight: 3, enabled: true, list: [] };
            St.state.bg.items.push(item);
          }
          item.enabled = true;
          urls.forEach(function (u) { item.list.push({ author: "本地", name: u.split("/").pop(), url: u }); });
          St.state.editingSourceId = item.id;
          St.save(); St.markDirty("js/bg-data.js");
          UI.renderBg();
          U.toast("已登记 " + urls.length + " 张本地图片");
          return true;
        }
      });
    });
    on("bgPreview", "onclick", function () {
      var pool = collectPreviewPool();
      if (!pool.length) { U.toast("没有可用条目", "err"); return; }
      var pick = pool[Math.floor(Math.random() * pool.length)];
      U.modal({
        title: "背景预览",
        html: '<div class="preview" style="background-image:url(\'' + U.esc(pick.url) + "')\"></div>" +
          '<p class="dim">' + U.esc((pick.author || "") + " - " + (pick.name || "") + "（" + (pick.vol || "") + "）") + "</p>",
        onOk: function () { return true; }
      });
    });
    on("bgReset", "onclick", function () {
      U.confirm("确定恢复默认背景配置吗？本机的自定义修改会被清除。").then(function (ok) {
        if (!ok) return;
        try { localStorage.removeItem(St.LS.bg); } catch (e) { }
        St.load();
        St.markDirty("js/bg-data.js");
        UI.renderBg();
        U.toast("已恢复默认背景配置");
      });
    });

    var bgTable = $("bgSourceTable");
    if (bgTable) {
      bgTable.addEventListener("change", function (e) {
        var t = e.target;
        var idx = +t.getAttribute("data-idx");
        var act = t.getAttribute("data-act");
        if (isNaN(idx)) return;
        var item = St.state.bg.items[idx];
        if (act === "toggle") item.enabled = t.checked;
        if (act === "weight") item.weight = +t.value || 0;
        St.save(); St.markDirty("js/bg-data.js");
      });
      bgTable.addEventListener("click", function (e) {
        var t = e.target;
        var act = t.getAttribute && t.getAttribute("data-act");
        var idx = +(t.getAttribute && t.getAttribute("data-idx"));
        if (!act || isNaN(idx)) return;
        if (act === "edit") {
          St.state.editingSourceId = St.state.bg.items[idx].id;
          St.save();
          UI.renderBg();
          UI.editSource(idx);
          return;
        }
        if (act === "up" && idx > 0) swap(St.state.bg.items, idx, idx - 1);
        else if (act === "down" && idx < St.state.bg.items.length - 1) swap(St.state.bg.items, idx, idx + 1);
        else if (act === "del") {
          var item = St.state.bg.items[idx];
          U.confirm("确定删除来源“" + item.name + "”吗？").then(function (ok) {
            if (!ok) return;
            St.state.bg.items.splice(idx, 1);
            St.save(); St.markDirty("js/bg-data.js");
            UI.renderBg();
            U.toast("已删除");
          });
          return;
        }
        St.save(); St.markDirty("js/bg-data.js");
        UI.renderBg();
      });
    }

    /* ---- 广播发布 ---- */
    on("bcSend", "onclick", UI.sendBroadcast);
    on("bcTest", "onclick", function () {
      if (global.Broadcast) global.Broadcast.test($("bcLevel").value);
      U.toast("已在本机试听");
    });
    on("bcTemplate", "onclick", function () {
      var tpls = [
        ["开考提醒", "请监考老师核对答题卡、试卷份数，考生按座位号就座，考试即将开始。"],
        ["时间调整", "因临时安排调整，本场考试时间变更为 XX:XX—XX:XX，请以广播为准。"],
        ["设备故障", "因听力设备故障，本场英语听力考试顺延，具体时间另行通知。"],
        ["结束提醒", "距离考试结束还有 15 分钟，请注意把握答题时间。"],
        ["考场纪律", "考试期间请保持考场安静，手机等电子设备一律关机并放到指定位置。"]
      ];
      U.modal({
        title: "常用广播模板",
        html: '<div class="tplList">' + tpls.map(function (t, i) {
          return '<a data-i="' + i + '">' + U.esc(t[0]) + "</a>";
        }).join("") + "</div>",
        onMount: function (body) {
          $$("a[data-i]", body).forEach(function (a) {
            a.onclick = function () {
              var t = tpls[+a.getAttribute("data-i")];
              if ($("bcText")) $("bcText").value = t[1];
              if ($("bcVoice")) $("bcVoice").value = t[1];
              $("modal").classList.remove("open");
            };
          });
        },
        onOk: function () { return true; }
      });
    });
    on("bcSaveFeed", "onclick", function () {
      var fs = global.FeedStore;
      fs.setFeedUrl($("bcFeedUrl").value);
      St.state.br.feedBranch = $("bcFeedBranch").value.trim() || "main";
      St.save();
      log("广播源已保存：" + fs.getFeedUrl());
      U.toast("已保存广播源配置");
    });
    on("bcPull", "onclick", function () {
      global.FeedStore.fetchRemote().then(function (ok) {
        UI.renderBroadcast(); UI.renderDash();
        U.toast(ok ? "已拉取远程广播" : "拉取失败或未配置广播源", ok ? "" : "err");
      });
    });
    on("bcPush", "onclick", function () {
      var fs = global.FeedStore;
      if (!fs.getFeedUrl()) { U.toast("请先配置广播源地址", "err"); return; }
      log("正在推送广播到远程…");
      fs.pushRemote().then(function () {
        log("广播已同步到远程");
        U.toast("广播已同步到远程");
      }).catch(function (e) {
        log("推送失败：" + e.message);
        U.toast("推送失败：" + e.message, "err");
      });
    });
    on("bcRefresh", "onclick", function () { UI.renderBroadcast(); UI.renderDash(); });
    on("bcExport", "onclick", function () {
      U.download("feed.json", St.buildFeedJson(), "application/json");
      log("已导出 feed.json");
    });
    on("bcClear", "onclick", function () {
      U.confirm("确定清空本机广播记录吗？").then(function (ok) {
        if (!ok) return;
        global.FeedStore.clear();
        St.markDirty("data/feed.json.js");
        St.markDirty("data/feed.json");
        UI.renderBroadcast(); UI.renderDash();
        U.toast("已清空本机广播");
      });
    });

    /* ---- 自动播报规则 ---- */
    on("brSave", "onclick", function () {
      St.state.br = UI.collectRules();
      St.save();
      St.markDirty("js/broadcast-data.js");
      if (global.FeedStore) global.FeedStore.setConfig(St.state.br);
      log("播报设置已保存并立即生效");
      U.toast("播报设置已保存");
    });
    on("brTestVoice", "onclick", function () {
      St.state.br = UI.collectRules();
      if (global.FeedStore) global.FeedStore.setConfig(St.state.br);
      if (global.Broadcast) global.Broadcast.speak("语音播报测试，现在时间是 " + new Date().toLocaleTimeString(), { gap: 0 });
    });
    on("brTestAlert", "onclick", function () {
      St.state.br = UI.collectRules();
      if (global.FeedStore) global.FeedStore.setConfig(St.state.br);
      if (global.Broadcast) global.Broadcast.test("important");
    });

    /* ---- 考试数据 ---- */
    on("loadExam", "onclick", UI.loadExamText);
    on("downloadExam", "onclick", function () {
      U.download("exam.js", $("examEditor").value || St.state.examSource || "");
      log("已下载 exam.js");
    });
    on("formatExam", "onclick", function () {
      var v = $("examEditor").value;
      v = v.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "");
      $("examEditor").value = v;
      St.state.examSource = v;
      St.save();
      log("已做简单格式化（去空行、去行尾空格）");
    });
    on("checkExam", "onclick", function () {
      var v = $("examEditor").value;
      St.state.examSource = v;
      St.save();
      var types = UI.collectExamTypes(v);
      if (types) {
        St.state.examTypes = types;
        UI.renderExamTable(types);
        $("examHint").innerHTML = '<span class="ok">语法正常，共 ' + types.length + " 个考试类型</span>";
        log("exam.js 语法检查通过，共 " + types.length + " 个类型");
      } else {
        log("exam.js 语法检查失败");
      }
    });
    on("examFile", "onchange", function () {
      var f = this.files && this.files[0];
      if (!f) return;
      U.readFile(f).then(function (txt) {
        $("examEditor").value = txt;
        St.state.examSource = txt;
        St.save();
        St.markDirty("js/exam.js");
        var types = UI.collectExamTypes(txt);
        if (types) { St.state.examTypes = types; UI.renderExamTable(types); }
        log("已从本地载入 " + f.name);
      }).catch(function () { U.toast("读取文件失败", "err"); });
    });

    /* ---- 站点外观 ---- */
    on("thSave", "onclick", function () {
      St.state.theme = {
        slogan: $("thSlogan").value, school: $("thSchool").value, version: $("thVersion").value,
        accent: $("thAccent").value, darken: +$("thDarken").value || 50, tip: $("thTip").value
      };
      St.save(); St.markDirty("js/site-data.js");
      log("外观设置已保存");
      U.toast("外观设置已保存");
    });
    on("thReset", "onclick", function () {
      St.state.theme = U.deepCopy(St.DEFAULT_THEME);
      St.save(); UI.renderTheme();
      U.toast("已恢复默认外观");
    });

    /* ---- 发布 / Token ---- */
    [["ghOwner", "owner"], ["ghRepo", "repo"], ["ghBranch", "branch"], ["ghMessage", "message"]].forEach(function (pair) {
      on(pair[0], "onchange", function () {
        St.state.gh[pair[1]] = $(pair[0]).value.trim();
        St.save();
      });
    });
    on("saveEncryptedToken", "onclick", function () {
      var t = $("ghToken").value.trim();
      var p = $("ghPass").value;
      if (!t || !p) { U.toast("请填写 Token 与口令", "err"); return; }
      U.encryptToken(t, p).then(function () {
        St.state.gh.token = t;
        $("ghToken").value = "";
        St.save();
        log("Token 已加密保存在本机");
        U.toast("Token 已加密保存");
      }).catch(function (e) { U.toast("保存失败：" + e.message, "err"); });
    });
    on("decryptFillToken", "onclick", function () {
      var enc = U.lsGet(U.C.LS_TOKEN, null);
      if (!enc) { U.toast("本机没有已保存的密文", "err"); return; }
      var p = $("ghPass").value;
      if (!p) { U.toast("请先输入加密口令", "err"); return; }
      U.decryptToken(enc, p).then(function (t) {
        $("ghToken").value = t;
        St.state.gh.token = t;
        log("Token 已解密填充");
        U.toast("Token 已填充");
      }).catch(function () { U.toast("解密失败：口令不正确", "err"); });
    });
    on("toggleTokenVisibility", "onclick", function () {
      var el = $("ghToken");
      el.type = el.type === "password" ? "text" : "password";
    });
    on("clearEncryptedToken", "onclick", function () {
      try { localStorage.removeItem(U.C.LS_TOKEN); } catch (e) { }
      U.lsSet(U.C.LS_TOKEN, null);
      log("已清除本机密文");
      U.toast("已清除本机 Token 密文");
    });

    on("pushSelected", "onclick", function () { publish(UI.selectedFiles()); });
    on("downloadSelected", "onclick", function () {
      UI.selectedFiles().forEach(function (path) {
        var f = St.FILES.filter(function (x) { return x.file === path; })[0];
        if (!f) return;
        U.download(path.split("/").pop(), St.buildOne(f));
      });
      log("已下载选中文件");
    });
    on("downloadAll", "onclick", function () {
      St.FILES.forEach(function (f) { U.download(f.file.split("/").pop(), St.buildOne(f)); });
      log("已逐个下载全部文件");
    });

    /* ---- 日志 ---- */
    on("logClear", "onclick", function () { $("status").textContent = ""; });
    on("logCopy", "onclick", function () {
      var t = $("status").textContent;
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { U.toast("日志已复制"); });
      else { $("status").select(); document.execCommand("copy"); }
    });
  }

  function swap(arr, i, j) {
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }

  function collectPreviewPool() {
    var out = [];
    if (!St.state.bg || !St.state.bg.settings) return out;
    St.state.bg.items.forEach(function (item) {
      if (item.enabled === false || !(item.weight > 0)) return;
      if (item.type === "gallery") {
        (global.galleryFlated || []).slice(0, 40).forEach(function (g) {
          out.push({ author: g.author, name: g.name, vol: g.vol, url: g.url });
        });
        (item.list || []).forEach(function (x) { if (x.url) out.push(x); });
      } else if (item.type === "online") {
        out.push({ author: item.author || "在线", name: "随机图", vol: item.name, url: item.api + (item.suffix || "") });
      } else {
        (item.list || []).forEach(function (x) { if (x.url) out.push(x); });
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ 发布 */
  function publish(paths) {
    if (!paths || !paths.length) { U.toast("请先选择要发布的文件", "err"); return; }
    var gh = St.state.gh;
    gh.owner = ($("ghOwner") && $("ghOwner").value.trim()) || gh.owner;
    gh.repo = ($("ghRepo") && $("ghRepo").value.trim()) || gh.repo;
    gh.branch = ($("ghBranch") && $("ghBranch").value.trim()) || gh.branch;
    gh.message = ($("ghMessage") && $("ghMessage").value.trim()) || gh.message;
    St.save();

    St.resolveToken().then(function (token) {
      if (!token) {
        log("发布中止：缺少 Token（请在上方填写 GitHub Token）");
        U.toast("请先填写 GitHub Token", "err");
        return;
      }
      St.state.gh.token = token;
      log("开始发布 " + paths.length + " 个文件到 " + gh.owner + "/" + gh.repo + "@" + gh.branch);
      var chain = Promise.resolve();
      paths.forEach(function (path) {
        chain = chain.then(function () {
          var f = St.FILES.filter(function (x) { return x.file === path; })[0];
          if (!f) { log("跳过未知文件：" + path); return; }
          var content = St.buildOne(f);
          if (f.needsEdit && !content) { log("跳过空文件：" + path + "（请先在“考试数据”里加载 exam.js）"); return; }
          log("正在提交 " + path + " …");
          return St.pushFile(path, content, gh.message + " (" + path + ")").then(function (sha) {
            log("✓ " + path + " 已提交 " + String(sha).slice(0, 8));
          }).catch(function (e) {
            log("✗ " + path + " 失败：" + e.message);
          });
        });
      });
      return chain;
    }).then(function () {
      log("发布流程结束");
      UI.renderPublish();
      U.toast("发布流程结束，详见日志");
    }).catch(function (e) {
      log("发布异常：" + e.message);
      U.toast("发布失败：" + e.message, "err");
    });
  }

  /* ------------------------------------------------------------ 初始化 */
  function init() {
    St.load();
    if (global.FeedStore) global.FeedStore.init();
    newCaptcha();
    bind();
    if (St.state.logged) enterConsole();
    else log("等待登录…（账号见 js/admin.js，登录状态仅保存在本机）");
  }

  /* 供调试 / 自动化测试使用 */
  global.__captchaAnswer = function () { return currentCaptcha ? currentCaptcha.ans : null; };
  global.__admin = {
    login: doLogin, logout: logout, switchTab: switchTab, publish: publish,
    state: St.state,
    build: function (path) {
      var f = St.FILES.filter(function (x) { return x.file === path; })[0];
      return f ? St.buildOne(f) : null;
    }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window);
