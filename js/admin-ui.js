/*
 * 管理控制台 · 界面渲染
 */
(function (global) {
  "use strict";
  var U = global.AdminUtil;
  var $ = U.$, $$ = U.$$;
  var St = global.AdminState;
  var log = function () { if (global.AdminLog) global.AdminLog.apply(null, arguments); };

  /* ============================================================== 概览 */
  function renderDash() {
    var bg = St.state.bg, br = St.state.br;
    $("statSources").textContent = (bg.items || []).length + " 个";
    $("statBgCurrent").textContent = "当前轮播：" + (bg.settings.enabled ? bg.settings.intervalSeconds + " 秒/张" : "已暂停") +
      " · " + bg.settings.order + " · " + bg.settings.effect;
    var fs = global.FeedStore;
    var msgs = (fs && fs.messages) || [];
    $("statMessages").textContent = msgs.length + " 条";
    $("statLastBroadcast").textContent = "最近：" + (msgs.length ? U.timeStr(msgs[msgs.length - 1].at) : "暂无");
    var types = St.state.examTypes || [];
    $("statExams").textContent = types.length + " 类";
    $("statExamTypes").textContent = types.map(function (t) { return t.type; }).slice(0, 6).join(" / ") || "未加载 exam.js";
    $("statVoice").textContent = br.settings.voice ? "已开启" : "已关闭";
  }

  /* ============================================================== 背景 */
  function renderBg() {
    var s = St.state.bg.settings;
    $("bgEnabled").value = s.enabled ? "1" : "0";
    $("bgInterval").value = s.intervalSeconds;
    $("bgOrder").value = s.order;
    $("bgTransitionMs").value = s.transitionMs;
    $("bgEffect").value = s.effect;
    $("bgDarken").value = s.darken;
    $("bgKenBurns").value = s.kenBurns ? "1" : "0";
    $("bgShowCaption").value = s.showCaption ? "1" : "0";
    renderBgTable();
    renderBgDetail();
  }

  function sourceTypeName(t) {
    return ({ gallery: "内置图库", static: "图片列表", online: "在线随机图", bing: "必应每日", local: "本地图片", gradient: "渐变", solid: "纯色", video: "视频", custom: "自定义 URL" })[t] || t;
  }

  function sourceCount(item) {
    if (item.type === "gallery") {
      var total = (item.list || []).length;
      if (global.galleryFlated) {
        total += (item.volumes && item.volumes.length)
          ? global.galleryFlated.filter(function (g) { return item.volumes.indexOf(g.vol) >= 0; }).length
          : global.galleryFlated.length;
      }
      return total;
    }
    if (item.type === "online") return "随机";
    if (item.type === "bing") return "每日更新";
    return (item.list || []).length;
  }

  function renderBgTable() {
    var tb = $("bgSourceTable").querySelector("tbody");
    tb.innerHTML = "";
    St.state.bg.items.forEach(function (item, idx) {
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td><input type="checkbox" data-act="toggle" data-idx="' + idx + '"' + (item.enabled !== false ? " checked" : "") + "></td>" +
        "<td>" + U.esc(item.name) + (item.id === "gallery-all" ? ' <span class="dim">全量</span>' : "") + "</td>" +
        '<td><span class="tag">' + sourceTypeName(item.type) + "</span></td>" +
        "<td>" + sourceCount(item) + "</td>" +
        '<td><input type="number" class="mini" data-act="weight" data-idx="' + idx + '" value="' + (item.weight == null ? 1 : item.weight) + '" min="0" max="99"></td>' +
        '<td class="row"><button class="ghost mini" data-act="edit" data-idx="' + idx + '">编辑</button>' +
        '<button class="ghost mini" data-act="up" data-idx="' + idx + '" title="上移">↑</button>' +
        '<button class="ghost mini" data-act="down" data-idx="' + idx + '" title="下移">↓</button>' +
        '<button class="danger mini" data-act="del" data-idx="' + idx + '">删除</button></td>';
      tb.appendChild(tr);
    });
  }

  function renderBgDetail() {
    var box = $("bgDetail");
    var item = St.state.bg.items.filter(function (i) { return i.id === St.state.editingSourceId; })[0];
    if (!item) {
      box.className = "detail dim";
      box.innerHTML = "点击来源右侧的“编辑”，查看 / 修改该来源的条目。";
      return;
    }
    box.className = "detail";
    var head = '<div class="space-between"><b>' + U.esc(item.name) + "</b>" +
      '<span class="dim">' + sourceTypeName(item.type) + " · 权重 " + item.weight + " · " + sourceCount(item) + " 个条目</span></div>";
    var body = "";
    if (item.type === "gallery") {
      body = '<p class="dim">该来源来自 js/gallery.js 的内置图库' + (item.list && item.list.length ? "，另外还包含 " + item.list.length + " 个自定义条目" : "") + "。</p>";
      (item.list || []).slice(0, 60).forEach(function (x, i) {
        body += '<div class="thumbItem"><span class="thumb" style="background-image:url(\'' + U.esc(x.url) + "')\"></span><span>" +
          U.esc(x.author + " - " + x.name) + '</span><a class="del" data-list="' + i + '">删除</a></div>';
      });
    } else if (item.type === "online") {
      body = '<div class="grid"><label>接口前缀<input type="text" data-field="api" value="' + U.esc(item.api || "") + '"></label>' +
        '<label>尺寸后缀<input type="text" data-field="suffix" value="' + U.esc(item.suffix || "") + '"></label>' +
        '<label>作者<input type="text" data-field="author" value="' + U.esc(item.author || "") + '"></label>' +
        '<label>主题词（逗号分隔）<input type="text" data-field="topics" value="' + U.esc((item.topics || []).join(",")) + '"></label></div>' +
        '<p class="dim">示例：<code>https://picsum.photos/seed/</code> + 随机种子 + <code>/1920/1080</code></p>';
    } else if (item.type === "bing") {
      body = '<div class="grid"><label>接口<input type="text" data-field="api" value="' + U.esc(item.api || "") + '"></label>' +
        '<label>图片前缀<input type="text" data-field="base" value="' + U.esc(item.base || "") + '"></label>' +
        '<label>缓存分钟<input type="number" data-field="cacheMinutes" value="' + (item.cacheMinutes || 180) + '"></label></div>';
    } else {
      var list = item.list || [];
      body = '<p class="dim">共 ' + list.length + " 个条目，最多展示 60 个。</p>";
      list.slice(0, 60).forEach(function (x, i) {
        var content = x.url || x.css || "";
        body += '<div class="thumbItem"><span class="thumb" style="' +
          (x.url ? "background-image:url('" + U.esc(x.url) + "')" : "background:" + U.esc(x.css || "#222")) + '"></span><span>' +
          U.esc((x.author || "") + " - " + (x.name || "")) + ' <span class="dim">' + U.esc(String(content).slice(0, 60)) + "</span></span>" +
          '<a class="del" data-list="' + i + '">删除</a></div>';
      });
      body += '<div class="actions"><button class="ghost" id="bgDetailAdd">追加条目</button></div>';
    }
    box.innerHTML = head + body;

    var addBtn = $("bgDetailAdd");
    if (addBtn) addBtn.onclick = function () { promptAddEntry(item); };
    $$("#bgDetail .del").forEach(function (a) {
      a.onclick = function () {
        item.list.splice(+a.getAttribute("data-list"), 1);
        St.save();
        St.markDirty("js/bg-data.js");
        renderBg();
        U.toast("已删除条目");
      };
    });
    $$("#bgDetail [data-field]").forEach(function (inp) {
      inp.onchange = function () {
        var f = inp.getAttribute("data-field");
        if (f === "topics") item.topics = inp.value.split(/[,，\s]+/).filter(Boolean);
        else if (f === "cacheMinutes") item.cacheMinutes = +inp.value;
        else item[f] = inp.value;
        St.save();
        St.markDirty("js/bg-data.js");
        U.toast("已更新来源设置");
      };
    });
  }

  function promptAddEntry(item) {
    U.modal({
      title: "追加背景条目",
      html:
        '<div class="grid">' +
        '<label>作者 / 来源<input type="text" id="mAuthor" placeholder="例如 灵亡"></label>' +
        '<label>名称<input type="text" id="mName" placeholder="例如 运动会"></label>' +
        "</div>" +
        '<label>图片 URL 或 CSS 渐变<input type="text" id="mUrl" placeholder="https://... 或 linear-gradient(...)"></label>' +
        '<label>类型<select id="mKind"><option value="url">图片 URL</option><option value="css">CSS 渐变 / 纯色</option></select></label>',
      onOk: function () {
        var author = $("mAuthor").value.trim() || "自定义";
        var name = $("mName").value.trim();
        var val = $("mUrl").value.trim();
        if (!val) { U.toast("请填写图片 URL", "err"); return null; }
        item.list = item.list || [];
        if ($("mKind").value === "css") item.list.push({ author: author, name: name, css: val });
        else item.list.push({ author: author, name: name, url: val });
        St.save(); St.markDirty("js/bg-data.js");
        renderBg();
        U.toast("已添加条目");
        return true;
      }
    });
  }

  function editSource(idx) {
    var item = St.state.bg.items[idx];
    U.modal({
      title: "编辑来源：" + item.name,
      html:
        '<label>名称<input type="text" id="mName" value="' + U.esc(item.name) + '"></label>' +
        '<div class="grid"><label>类型<select id="mType">' +
        ["gallery", "static", "online", "bing", "local", "gradient", "solid", "video", "custom"].map(function (t) {
          return '<option value="' + t + '"' + (item.type === t ? " selected" : "") + ">" + sourceTypeName(t) + "</option>";
        }).join("") +
        "</select></label>" +
        '<label>权重<input type="number" id="mWeight" min="0" max="99" value="' + (item.weight == null ? 1 : item.weight) + '"></label>' +
        '<label>启用<select id="mEnabled"><option value="1"' + (item.enabled !== false ? " selected" : "") + ">启用</option><option value=\"0\"" + (item.enabled === false ? " selected" : "") + ">停用</option></select></label>" +
        '<label>授权说明<input type="text" id="mLicense" value="' + U.esc(item.license || "") + '"></label></div>' +
        "<p class=\"dim\">条目内容可在下方“当前来源明细”里查看与删除；图片 URL 建议使用 https 或仓库相对路径（如 ./images/1.jpg）。</p>",
      onOk: function () {
        item.name = $("mName").value.trim() || item.name;
        item.type = $("mType").value;
        item.weight = +$("mWeight").value || 0;
        item.enabled = $("mEnabled").value === "1";
        item.license = $("mLicense").value.trim();
        St.state.editingSourceId = item.id;
        St.save(); St.markDirty("js/bg-data.js");
        renderBg();
        U.toast("来源已保存");
        return true;
      }
    });
  }

  function addSource() {
    U.modal({
      title: "新增背景来源",
      html:
        '<label>名称<input type="text" id="mName" placeholder="例如：校园随手拍"></label>' +
        '<div class="grid">' +
        '<label>类型<select id="mType">' +
        '<option value="static">图片列表（图床 / 本地）</option>' +
        '<option value="gradient">渐变</option><option value="solid">纯色</option>' +
        '<option value="video">动态视频</option><option value="online">在线随机图</option>' +
        "</select></label>" +
        '<label>权重<input type="number" id="mWeight" value="3" min="0" max="99"></label></div>' +
        '<label>图片地址（每行一个，可填多行）<textarea id="mUrls" rows="4" placeholder="https://example.com/1.jpg&#10;./images/2.jpg"></textarea></label>',
      onOk: function () {
        var id = "src-" + Date.now().toString(36);
        var type = $("mType").value;
        var urls = $("mUrls").value.split(/\s*\n\s*/).filter(Boolean);
        var item = {
          id: id, type: type, name: $("mName").value.trim() || "新来源",
          weight: +$("mWeight").value || 1, enabled: true, list: []
        };
        urls.forEach(function (u, i) {
          if (type === "gradient" || type === "solid") item.list.push({ author: "自定义", name: "样式 " + (i + 1), css: u });
          else if (type === "video") item.list.push({ author: "自定义", name: "视频 " + (i + 1), url: u });
          else item.list.push({ author: "自定义", name: "图片 " + (i + 1), url: u });
        });
        if (type === "online" && urls[0]) item.api = urls[0];
        St.state.bg.items.push(item);
        St.state.editingSourceId = id;
        St.save(); St.markDirty("js/bg-data.js");
        renderBg();
        U.toast("已新增来源");
        return true;
      }
    });
  }

  /* ============================================================== 广播 */
  function renderBroadcast() {
    var fs = global.FeedStore;
    var tb = $("bcTable").querySelector("tbody");
    tb.innerHTML = "";
    var list = ((fs && fs.messages) || []).slice().reverse();
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="5" class="dim">暂无广播</td></tr>';
    }
    list.forEach(function (m) {
      var expired = m.until && new Date(m.until).getTime() < Date.now();
      var tr = document.createElement("tr");
      tr.innerHTML =
        "<td>" + U.timeStr(m.at) + "</td>" +
        '<td><span class="tag lv-' + U.esc(m.level) + '">' + U.esc(m.level) + "</span></td>" +
        "<td>" + U.esc(String(m.text).replace(/<[^>]*>/g, "")) + (m.pin ? ' <span class="tag">固定</span>' : "") + "</td>" +
        "<td>" + (expired ? '<span class="dim">已过期</span>' : '<span class="ok">生效中</span>') + "</td>" +
        '<td class="row"><button class="ghost mini" data-id="' + U.esc(m.id) + '" data-act="replay">重播</button>' +
        '<button class="danger mini" data-id="' + U.esc(m.id) + '" data-act="del">删除</button></td>';
      tb.appendChild(tr);
    });
    $$("#bcTable button").forEach(function (b) {
      b.onclick = function () {
        var id = b.getAttribute("data-id");
        if (b.getAttribute("data-act") === "del") {
          fs.remove(id); renderBroadcast(); U.toast("已删除广播");
        } else {
          var m = fs.messages.filter(function (x) { return x.id === id; })[0];
          if (m && global.Broadcast) {
            var bak = global.Broadcast.engine.announced;
            global.Broadcast.engine.announced = {};
            global.Broadcast.announce(m.text, { level: m.level, voice: m.voice || m.text, source: "重播", dedupeKey: "replay|" + Date.now() });
            global.Broadcast.engine.announced = bak;
          }
        }
      };
    });
    if ($("bcFeedUrl")) $("bcFeedUrl").value = (fs && fs.getFeedUrl()) || "";
    if ($("bcFeedBranch")) $("bcFeedBranch").value = St.state.br.feedBranch || "main";
  }

  function sendBroadcast() {
    var fs = global.FeedStore;
    var text = $("bcText").value.trim();
    if (!text) { U.toast("请填写广播正文", "err"); return; }
    var msg = {
      id: "bc-" + Date.now().toString(36),
      at: new Date().toISOString(),
      until: $("bcUntil").value ? new Date($("bcUntil").value).toISOString() : "",
      level: $("bcLevel").value,
      text: text,
      voice: $("bcVoice").value.trim() || text.replace(/<[^>]*>/g, ""),
      pin: $("bcPin").checked,
      source: "管理控制台"
    };
    fs.send(msg);
    St.markDirty("data/feed.json.js");
    St.markDirty("data/feed.json");
    if (global.Broadcast) {
      global.Broadcast.engine.announced = {};
      global.Broadcast.announce(msg.text, { level: msg.level, voice: msg.voice, pin: msg.pin, dedupeKey: "feed|" + msg.id, source: msg.source, duration: msg.pin ? 0 : 60 });
    }
    $("bcText").value = ""; $("bcVoice").value = "";
    renderBroadcast();
    renderDash();
    U.toast("广播已发出");
    log("[广播] " + msg.level + " · " + text.slice(0, 40));
  }

  /* ============================================================== 规则 */
  function renderRules() {
    var br = St.state.br, s = br.settings, e = br.exam || {}, c = br.clock || {}, d = br.discipline || {}, t = br.timeSync || {};
    $("brEnabled").value = s.enabled ? "1" : "0";
    $("brVoice").value = s.voice ? "1" : "0";
    $("brRate").value = s.rate;
    $("brPitch").value = s.pitch;
    $("brVolume").value = s.volume;
    $("brChime").value = s.chime ? "1" : "0";
    $("brBanner").value = s.showBanner ? "1" : "0";
    $("brNotify").value = s.notify ? "1" : "0";
    $("brPoll").value = s.pollSeconds;
    fillVoices(s.voiceName);
    $("brExamEnabled").value = e.enabled ? "1" : "0";
    $("brBeforeStart").value = (e.beforeStart || []).join(",");
    $("brAfterStart").value = (e.afterStart || []).join(",");
    $("brBeforeEnd").value = (e.beforeEnd || []).join(",");
    $("brAfterEnd").value = e.afterEnd ? "1" : "0";
    var tp = e.templates || {};
    $("tplBeforeStart").value = tp.beforeStart || "";
    $("tplStart").value = tp.start || "";
    $("tplAfterStart").value = tp.afterStart || "";
    $("tplBeforeEnd").value = tp.beforeEnd || "";
    $("tplEnd").value = tp.end || "";
    $("clkEnabled").value = c.enabled ? "1" : "0";
    $("clkMinutes").value = (c.minutes || []).join(",");
    $("clkOnlyExam").value = c.onlyDuringExam ? "1" : "0";
    $("clkTemplate").value = c.template || "";
    $("disEnabled").value = d.enabled ? "1" : "0";
    $("disEvery").value = d.everyMinutes || 30;
    $("disOnlyExam").value = d.onlyDuringExam ? "1" : "0";
    $("disItems").value = (d.items || []).join("\n");
    $("tsEnabled").value = t.enabled ? "1" : "0";
    $("tsUrl").value = t.url || "";
    $("tsField").value = t.field || "";
    $("tsOffset").value = t.offsetMs || 0;
    renderExamToggle();
  }

  /* --------------------------------------------- 逐场考试自动播报开关 */
  function mutedList() {
    if (!St.state.draftMuted) {
      St.state.draftMuted = (St.state.br.exam && St.state.br.exam.mutedTypes || []).map(String);
    }
    return St.state.draftMuted;
  }

  function renderExamToggle() {
    var tb = $("examToggleTable") && $("examToggleTable").querySelector("tbody");
    if (!tb) return;
    var types = St.state.examTypes;
    var hint = $("exHint");
    if (!types || !types.length) {
      tb.innerHTML = '<tr><td colspan="5" class="dim">还没有考试类型数据，请先在“考试数据”页加载 exam.js，或点“重新载入类型”。</td></tr>';
      if (hint) hint.textContent = "未加载 exam.js";
      return;
    }
    var muted = mutedList();
    tb.innerHTML = "";
    types.forEach(function (t, i) {
      var on = muted.indexOf(String(t.key)) < 0;
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td><input type="checkbox" data-act="mute" data-idx="' + i + '"' + (on ? " checked" : "") + "></td>" +
        "<td><code>" + U.esc(t.key) + "</code></td>" +
        "<td>" + U.esc(t.type) + "</td>" +
        "<td>" + U.esc(String(t.slogan || "").slice(0, 24)) + "</td>" +
        "<td>" + (t.voice === false ? '<span class="dim">未开启</span>' : '<span class="ok">已开启</span>') + "</td>";
      tb.appendChild(tr);
    });
    if (hint) hint.innerHTML = "共 " + types.length + " 类，已关闭 " + muted.length + " 类";
  }

  function collectMuted() {
    var out = [];
    $$("#examToggleTable input[data-act=mute]").forEach(function (c) {
      if (!c.checked) {
        var i = +c.getAttribute("data-idx");
        var t = St.state.examTypes && St.state.examTypes[i];
        if (t) out.push(String(t.key));
      }
    });
    return out;
  }

  function setAllMuted(allOff) {
    var types = St.state.examTypes || [];
    St.state.draftMuted = allOff ? types.map(function (t) { return String(t.key); }) : [];
    renderExamToggle();
  }

  function fillVoices(selected) {
    var sel = $("brVoiceName");
    if (!sel) return;
    var vs = (global.speechSynthesis && speechSynthesis.getVoices()) || [];
    sel.innerHTML = '<option value="">自动选择中文语音</option>' + vs.map(function (v) {
      return '<option value="' + U.esc(v.name) + '"' + (v.name === selected ? " selected" : "") + ">" + U.esc(v.name + " (" + v.lang + ")") + "</option>";
    }).join("");
  }

  function collectRules() {
    var br = St.state.br;
    var s = br.settings;
    s.enabled = $("brEnabled").value === "1";
    s.voice = $("brVoice").value === "1";
    s.rate = +$("brRate").value || 1;
    s.pitch = +$("brPitch").value || 1;
    s.volume = $("brVolume").value === "" ? 1 : +$("brVolume").value;
    s.voiceName = $("brVoiceName").value;
    s.chime = $("brChime").value === "1";
    s.showBanner = $("brBanner").value === "1";
    s.notify = $("brNotify").value === "1";
    s.pollSeconds = +$("brPoll").value || 15;

    br.exam = br.exam || {};
    br.exam.enabled = $("brExamEnabled").value === "1";
    br.exam.mutedTypes = collectMuted();
    br.exam.beforeStart = parseNums($("brBeforeStart").value);
    br.exam.afterStart = parseNums($("brAfterStart").value);
    br.exam.beforeEnd = parseNums($("brBeforeEnd").value);
    br.exam.afterEnd = $("brAfterEnd").value === "1";
    br.exam.templates = {
      beforeStart: $("tplBeforeStart").value,
      start: $("tplStart").value,
      afterStart: $("tplAfterStart").value,
      beforeEnd: $("tplBeforeEnd").value,
      end: $("tplEnd").value
    };

    br.clock = {
      enabled: $("clkEnabled").value === "1",
      minutes: parseNums($("clkMinutes").value),
      onlyDuringExam: $("clkOnlyExam").value === "1",
      template: $("clkTemplate").value
    };

    br.discipline = {
      enabled: $("disEnabled").value === "1",
      everyMinutes: +$("disEvery").value || 30,
      onlyDuringExam: $("disOnlyExam").value === "1",
      items: $("disItems").value.split(/\s*\n\s*/).filter(Boolean)
    };

    br.timeSync = {
      enabled: $("tsEnabled").value === "1",
      url: $("tsUrl").value.trim(),
      field: $("tsField").value.trim(),
      offsetMs: +$("tsOffset").value || 0
    };
    return br;
  }

  function parseNums(str) {
    return String(str || "").split(/[,，\s]+/).map(function (x) { return parseFloat(x); }).filter(function (n) { return !isNaN(n); });
  }

  /* ============================================================== 考试 */
  function renderExamTable(types) {
    var tb = $("examTable").querySelector("tbody");
    tb.innerHTML = "";
    if (!types || !types.length) {
      tb.innerHTML = '<tr><td colspan="5" class="dim">尚未加载 exam.js</td></tr>';
      return;
    }
    types.forEach(function (t) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + U.esc(t.key) + "</td><td>" + U.esc(t.type) + "</td><td>" +
        U.esc(t.origin || t.author || "-") + "</td><td>" + U.esc(String(t.slogan || "").slice(0, 30)) + "</td><td>" +
        (t.voice ? '<span class="ok">开</span>' : '<span class="dim">关</span>') + "</td>";
      tb.appendChild(tr);
    });
  }

  function collectExamTypes(src) {
    try {
      var sandbox = {};
      var fn = new Function("exams", "console", src + "\n;return exams;");
      var exams = fn(sandbox, { log: function () { }, group: function () { }, groupEnd: function () { }, groupCollapsed: function () { }, warn: function () { } });
      return Object.keys(exams).map(function (k) {
        var e = exams[k] || {};
        return {
          key: k, type: e.type || k, origin: e.origin, author: e.author,
          slogan: e.mainSlogan || (e.rollSlogan || [])[0],
          voice: e.voiceReminder !== false
        };
      });
    } catch (err) {
      $("examHint").innerHTML = '<span class="err">语法检查失败：' + U.esc(err.message) + "</span>";
      return null;
    }
  }

  function loadExamText() {
    log("尝试加载 ./js/exam.js");
    return fetch("./js/exam.js", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); })
      .then(function (txt) {
        $("examEditor").value = txt;
        St.state.examSource = txt;
        var types = collectExamTypes(txt);
        if (types) {
          St.state.examTypes = types;
          St.state.draftMuted = null;
          renderExamTable(types);
          renderExamToggle();
          $("examHint").innerHTML = '<span class="ok">已解析 ' + types.length + " 个考试类型</span>";
        }
        log("exam.js 已加载（" + txt.length + " 字符）");
        return txt;
      })
      .catch(function (e) {
        log("加载 exam.js 失败：" + e.message + "（file:// 下请用本地文件选择）");
        U.toast("加载失败，可改用本地文件", "err");
      });
  }

  /* ============================================================== 外观 */
  function renderTheme() {
    var t = St.state.theme;
    $("thSlogan").value = t.slogan;
    $("thSchool").value = t.school;
    $("thVersion").value = t.version;
    $("thAccent").value = t.accent;
    $("thDarken").value = t.darken;
    $("thTip").value = t.tip;
  }

  /* ============================================================== 发布 */
  function renderPublish() {
    var tb = $("publishTable").querySelector("tbody");
    tb.innerHTML = "";
    St.FILES.forEach(function (f, i) {
      var dirty = St.state.dirty[f.file] !== false && St.state.dirty[f.file] !== undefined;
      var tr = document.createElement("tr");
      tr.innerHTML =
        '<td><input type="checkbox" data-file="' + U.esc(f.file) + '" checked></td>' +
        "<td><code>" + U.esc(f.file) + "</code>" + (dirty ? ' <span class="tag warn">待发布</span>' : "") + "</td>" +
        "<td>" + U.esc(f.desc) + "</td>" +
        '<td class="row"><button class="ghost mini" data-build="' + i + '">预览</button>' +
        '<button class="ghost mini" data-dl="' + i + '">下载</button></td>';
      tb.appendChild(tr);
    });
    $$("#publishTable button").forEach(function (b) {
      b.onclick = function () {
        var idx = +(b.getAttribute("data-build") != null ? b.getAttribute("data-build") : b.getAttribute("data-dl"));
        var f = St.FILES[idx];
        var content = St.buildOne(f);
        if (b.getAttribute("data-dl") != null) {
          U.download(f.file.split("/").pop(), content);
          log("已下载 " + f.file);
          return;
        }
        U.modal({
          title: "预览 " + f.file,
          html: '<pre class="status" style="max-height:45vh">' + U.esc(content.slice(0, 20000)) + "</pre>",
          onOk: function () { return true; }
        });
      };
    });
    $("ghOwner").value = St.state.gh.owner;
    $("ghRepo").value = St.state.gh.repo;
    $("ghBranch").value = St.state.gh.branch;
    $("ghMessage").value = St.state.gh.message;
  }

  /* 收集"发布"页勾选的文件（用 data-file 属性判断，兼容各种 DOM 实现） */
  function selectedFiles() {
    var table = $("publishTable");
    if (!table) return [];
    var out = [];
    var visit = function (node) {
      (node.children || []).forEach(function (c) {
        if (c.tagName === "INPUT" && c.getAttribute("data-file") && c.checked !== false) out.push(c.getAttribute("data-file"));
        visit(c);
      });
    };
    visit(table);
    return out;
  }

  global.AdminUI = {
    renderDash: renderDash,
    renderBg: renderBg,
    renderBgTable: renderBgTable,
    renderBroadcast: renderBroadcast,
    renderRules: renderRules,
    renderExamToggle: renderExamToggle,
    setAllMuted: setAllMuted,
    collectMuted: collectMuted,
    renderExamTable: renderExamTable,
    renderTheme: renderTheme,
    renderPublish: renderPublish,
    editSource: editSource,
    addSource: addSource,
    sendBroadcast: sendBroadcast,
    collectRules: collectRules,
    collectExamTypes: collectExamTypes,
    loadExamText: loadExamText,
    fillVoices: fillVoices,
    selectedFiles: selectedFiles,
    sourceCount: sourceCount,
    sourceTypeName: sourceTypeName
  };
})(window);
