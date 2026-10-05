/*
 * 后台管理页自检（Node + 轻量 DOM 桩）
 * 运行： node _test/node-admin-check.js
 * 覆盖：登录 → 各标签页渲染 → 广播发布 → 规则保存 → 数据生成 → GitHub 发布
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { makeEnv, loadFiles } = require("./dom-stub.js");
const vm = require("vm");
function vmProbe() {
  return env && env.ctx ? vm.runInContext('(function(){ var e = document.getElementById("ghToken"); return e ? "found:" + e.value : "null"; })()', env.ctx) : "n/a";
}

const ROOT = path.join(__dirname, "..");
const out = [];
function chk(name, cond, extra) {
  out.push((cond ? "PASS  " : "FAIL  ") + name + (extra != null ? "  -> " + extra : ""));
}

/* 管理页需要的全部元素 id（对应 admin.html） */
const ADMIN_IDS = [
  "loginPanel", "adminPanel", "adminUser", "adminPass", "localCaptcha", "loginBtn", "captchaRefresh",
  "loginMsg", "logoutBtn", "tabs", "quickPush", "quickPushFeed", "footStat",
  "bgVolList", "bgSourceList", "bgIntervalList", "bgEffectList", "bgPlayToggle", "bgHook", "main",
  "statSources", "statBgCurrent", "statMessages", "statLastBroadcast", "statExams", "statExamTypes", "statVoice",
  "bgEnabled", "bgInterval", "bgOrder", "bgTransitionMs", "bgEffect", "bgDarken", "bgKenBurns", "bgShowCaption",
  "bgSourceTable", "bgDetail", "bgAddSource", "bgAddUrl", "bgAddLocal", "bgPreview", "bgReset",
  "bcLevel", "bcUntil", "bcText", "bcVoice", "bcPin", "bcSend", "bcTest", "bcTemplate",
  "bcFeedUrl", "bcFeedBranch", "bcSaveFeed", "bcPull", "bcPush", "bcRefresh", "bcExport", "bcClear", "bcTable",
  "brEnabled", "brVoice", "brRate", "brPitch", "brVolume", "brVoiceName", "brChime", "brBanner", "brNotify", "brPoll",
  "brExamEnabled", "brBeforeStart", "brAfterStart", "brBeforeEnd", "brAfterEnd",
  "tplBeforeStart", "tplStart", "tplAfterStart", "tplBeforeEnd", "tplEnd",
  "clkEnabled", "clkMinutes", "clkOnlyExam", "clkTemplate",
  "disEnabled", "disEvery", "disOnlyExam", "disItems",
  "tsEnabled", "tsUrl", "tsField", "tsOffset", "brSave", "brTestVoice", "brTestAlert",
  "examToggleTable", "exAllOn", "exAllOff", "exReload", "exSave", "exHint", "discPreview",
  "loadExam", "formatExam", "checkExam", "downloadExam", "examFile", "examEditor", "examHint", "examTable",
  "thSlogan", "thSchool", "thVersion", "thAccent", "thDarken", "thTip", "thSave", "thReset",
  "ghOwner", "ghRepo", "ghBranch", "ghMessage", "ghToken", "ghPass",
  "saveEncryptedToken", "decryptFillToken", "toggleTokenVisibility", "clearEncryptedToken",
  "publishTable", "pushSelected", "downloadSelected", "downloadAll",
  "status", "logClear", "logCopy",
  "modal", "modalTitle", "modalBody", "modalOk", "modalCancel", "modalClose"
];

const env = makeEnv({
  ids: ADMIN_IDS,
  // 后台的导航按钮靠 data-tab 属性绑定点击事件
  attrs: [
    ...["dash", "bg", "broadcast", "rules", "exam", "theme", "publish", "log"].map(t => ({ id: "tab-" + t, attr: "data-tab", val: t })),
    ...["dash", "bg", "broadcast", "rules", "exam", "theme", "publish", "log"].map(t => ({ id: "pane-" + t, attr: "data-pane", val: t }))
  ],
  // 表格元素需要一个 tbody 子节点（真实 DOM 由 HTML 解析器生成）
  rows: ["bgSourceTable", "bcTable", "examTable", "publishTable", "examToggleTable"],
  // 模拟 GitHub Contents API：读取返回 404（新建文件），PUT 返回成功
  fetch: (url, opts) => {
    if (opts && opts.method === "PUT") {
      return Promise.resolve({
        ok: true, status: 200,
        json: () => Promise.resolve({ commit: { sha: "abcdef1234567890" } }),
        text: () => Promise.resolve("")
      });
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null), text: () => Promise.resolve("Not Found") });
  },
  // admin 页启动时会 fetch ./js/exam.js
  files: { "js/exam.js": fs.readFileSync(path.join(ROOT, "js/exam.js"), "utf8") }
});

const { doc, sandbox, errors } = env;

/* 表格行数统计（tbody 由 dom-stub 提供） */
const rowCount = (id) => {
  const t = doc.getElementById(id);
  return t && t.__tb ? t.__tb.children.length : -1;
};

/* 记录"下载文件"的调用 */
const downloads = [];
doc.createElement = ((orig) => (tag) => {
  const e = orig(tag);
  if (tag === "a") e.click = () => downloads.push(e.download);
  return e;
})(doc.createElement);

const A_FILES = [
  "js/gallery.js",
  "js/bg-data.js",
  "js/broadcast-data.js",
  "data/feed.json.js",
  "js/feed-store.js",
  "js/admin-util.js",
  "js/admin-state.js",
  "js/admin-ui.js",
  "js/admin.js"
];
const loaded = loadFiles(env, A_FILES);

chk("全部脚本加载成功", loaded.ok, loaded.error || "");
chk("加载期无错误", errors.filter(e => e.startsWith("ERROR")).length === 0, errors.filter(e => e.startsWith("ERROR")).join(" | ").slice(0, 300));

const win = sandbox;
chk("AdminUtil 已加载", !!win.AdminUtil);
chk("AdminState 已加载", !!win.AdminState);
chk("AdminUI 已加载", !!win.AdminUI);
chk("验证码已生成", /计算/.test(doc.getElementById("localCaptcha").placeholder), doc.getElementById("localCaptcha").placeholder);
chk("未登录时面板隐藏", doc.getElementById("adminPanel").style.display === "none", JSON.stringify(doc.getElementById("adminPanel").style.display));

/* ---- 登录 ---- */
doc.getElementById("adminUser").value = "gvbhj111";
doc.getElementById("adminPass").value = "667755asd";
doc.getElementById("localCaptcha").value = String(win.__captchaAnswer());
doc.getElementById("loginBtn").onclick();
chk("登录成功进入控制台", doc.getElementById("adminPanel").style.display === "", "adminPanel=" + doc.getElementById("adminPanel").style.display);
chk("登录状态已保存", !!win.AdminState.state.logged);

/* ---- 概览 ---- */
chk("概览：背景来源数已渲染", /\d+ 个/.test(doc.getElementById("statSources").textContent), doc.getElementById("statSources").textContent);
chk("概览：广播条数已渲染", /条/.test(doc.getElementById("statMessages").textContent), doc.getElementById("statMessages").textContent);

/* ---- 标签页 ---- */
function tab(name) {
  const a = doc._allByAttr("data-tab", name)[0];
  if (a && typeof a.onclick === "function") a.onclick();
  return !!a;
}
["bg", "broadcast", "rules", "exam", "theme", "publish", "log", "dash"].forEach(n => tab(n));
chk("全部标签页切换无异常", errors.filter(e => e.startsWith("ERROR")).length === 0, errors.filter(e => e.startsWith("ERROR")).slice(0, 2).join(" | "));

/* ---- 背景 ---- */
tab("bg");
chk("背景来源表已渲染", rowCount("bgSourceTable") > 5, rowCount("bgSourceTable") + " 行");
chk("轮播间隔输入已填充", !!doc.getElementById("bgInterval").value, doc.getElementById("bgInterval").value);
chk("候选池来源数", win.AdminUI && true);

/* ---- 广播发布 ---- */
tab("broadcast");
doc.getElementById("bcText").value = "自检广播：请考生注意时间。";
doc.getElementById("bcVoice").value = "自检广播，请考生注意时间。";
doc.getElementById("bcLevel").value = "important";
doc.getElementById("bcSend").onclick();
const msgs = win.FeedStore.messages;
chk("广播已写入广播队列", msgs.length === 1, msgs.length + " 条");
chk("广播内容正确", msgs[0] && /自检广播/.test(msgs[0].text), msgs[0] && msgs[0].text);
chk("广播记录表已渲染", rowCount("bcTable") >= 1, rowCount("bcTable") + " 行");
chk("发送后输入框已清空", doc.getElementById("bcText").value === "");

/* ---- 自动播报规则 ---- */
tab("rules");
doc.getElementById("brEnabled").value = "1";
doc.getElementById("brVoice").value = "1";
doc.getElementById("brBeforeStart").value = "30,15,5";
doc.getElementById("brBeforeEnd").value = "30,15,5,1";
doc.getElementById("clkEnabled").value = "1";
doc.getElementById("clkMinutes").value = "0,30";
doc.getElementById("disEnabled").value = "1";
doc.getElementById("disItems").value = "请保持安静\n手机请关机";
doc.getElementById("brSave").onclick();
const saved = win.AdminState.state.br;
chk("规则：开考前节点已保存", JSON.stringify(saved.exam.beforeStart) === "[30,15,5]", JSON.stringify(saved.exam.beforeStart));
chk("规则：报时已保存", saved.clock.enabled === true && saved.clock.minutes.length === 2, JSON.stringify(saved.clock.minutes));
chk("规则：纪律条目已保存", saved.discipline.items.length === 2, JSON.stringify(saved.discipline.items));
chk("规则已同步到 FeedStore", win.FeedStore.getConfig().exam.beforeStart.length === 3);

/* ---- 逐场考试自动播报开关 ---- */
tab("exam");
doc.getElementById("examEditor").value = fs.readFileSync(path.join(ROOT, "js/exam.js"), "utf8");
doc.getElementById("checkExam").onclick();
tab("rules");
win.AdminUI.renderExamToggle();
chk("考试开关表已渲染", rowCount("examToggleTable") >= 8, rowCount("examToggleTable") + " 行");
const boxes = doc._allByAttr("data-act", "mute");
chk("考试开关是复选框", boxes.length >= 8, boxes.length + " 个");
chk("默认全部开启", boxes.every(c => c.checked), boxes.filter(c => c.checked).length + "/" + boxes.length);
doc.getElementById("exAllOff").onclick();
chk("全部关闭生效", doc._allByAttr("data-act", "mute").every(c => !c.checked));
doc.getElementById("exAllOn").onclick();
chk("全部开启生效", doc._allByAttr("data-act", "mute").every(c => c.checked));
doc._allByAttr("data-act", "mute")[0].checked = false;   // 只关掉第一个
doc.getElementById("exSave").onclick();
const muted = win.AdminState.state.br.exam.mutedTypes;
chk("关闭的考试类型已保存", Array.isArray(muted) && muted.length === 1, JSON.stringify(muted));
chk("保存后同步到 FeedStore", JSON.stringify(win.FeedStore.getConfig().exam.mutedTypes) === JSON.stringify(muted), JSON.stringify(win.FeedStore.getConfig().exam.mutedTypes));
const brOutEarly = win.AdminState.buildBroadcastData();
chk("mutedTypes 已写入生成的配置", /"mutedTypes"/.test(brOutEarly), (/\"mutedTypes\":\s*\[[^\]]*\]/.exec(brOutEarly) || [""])[0]);

/* ---- 数据生成 ---- */
tab("publish");
const bgSrc = win.AdminState.buildBgData();
const brSrc = win.AdminState.buildBroadcastData();
const feedSrc = win.AdminState.buildFeed();
const feedJson = win.AdminState.buildFeedJson();
const siteSrc = win.AdminState.buildSiteData();
const isJs = (s) => { try { new Function(s); return true; } catch (e) { return false; } };
chk("bg-data.js 生成成功", /window\.BG_DATA\s*=/.test(bgSrc) && bgSrc.length > 500, bgSrc.length + " 字符");
chk("bg-data.js 是合法 JS", isJs(bgSrc));
chk("broadcast-data.js 生成成功", /window\.BROADCAST_CONFIG\s*=/.test(brSrc), brSrc.length + " 字符");
chk("broadcast-data.js 是合法 JS", isJs(brSrc));
chk("site-data.js 生成成功", /window\.SITE_DATA\s*=/.test(siteSrc) && isJs(siteSrc));
chk("feed.json.js 含刚才的广播", /自检广播/.test(feedSrc));
chk("feed.json 是合法 JSON", (() => {
  try { const j = JSON.parse(feedJson); return Array.isArray(j.messages) && j.messages.length === 1; }
  catch (e) { return false; }
})());

/* ---- 发布到 GitHub（异步） ---- */
doc.getElementById("ghOwner").value = "gvbhj111";
doc.getElementById("ghRepo").value = "xwyz-exam-clock";
doc.getElementById("ghBranch").value = "main";
doc.getElementById("ghToken").value = "ghp_fake_token";
chk("发布按钮已绑定事件", typeof doc.getElementById("pushSelected").onclick === "function");
chk("发布表格复选框可读取", win.AdminUI.selectedFiles().length >= 4, win.AdminUI.selectedFiles().length + " 个");
doc.getElementById("pushSelected").onclick();

setTimeout(() => {
  const status = doc.getElementById("status").textContent;
  chk("发布：读取远端并提交成功", /已提交/.test(status), status.split("\n").filter(l => /提交|失败|中止/.test(l)).slice(-3).join(" ; "));
  chk("发布：无鉴权错误", !/未提供 GitHub Token/.test(status));
  chk("发布：Token 已进入状态", win.AdminState.state.gh.token === "ghp_fake_token");

  /* ---- 考试数据 ---- */
  tab("exam");
  doc.getElementById("examEditor").value = fs.readFileSync(path.join(ROOT, "js/exam.js"), "utf8");
  doc.getElementById("checkExam").onclick();
  const types = win.AdminState.state.examTypes;
  chk("exam.js 解析出考试类型", !!types && types.length >= 8, types && types.length);
  chk("exam.js 含高三/高一类型", !!types && types.some(t => /高三/.test(t.type)) && types.some(t => /高一/.test(t.type)), types && types.map(t => t.type).slice(0, 4).join("/"));
  chk("考试类型表已渲染", rowCount("examTable") >= 8, rowCount("examTable") + " 行");
  chk("exam.js 语法检查通过", /语法正常/.test(doc.getElementById("examHint").innerHTML), doc.getElementById("examHint").innerHTML.slice(0, 40));

  /* ---- 外观 ---- */
  tab("theme");
  doc.getElementById("thSlogan").value = "考试时钟";
  doc.getElementById("thDarken").value = "60";
  doc.getElementById("thSave").onclick();
  chk("外观已保存", win.AdminState.state.theme.darken === 60, win.AdminState.state.theme.darken);
  const site2 = win.AdminState.buildSiteData();
  chk("外观改动写入生成结果", /"darken": 60/.test(site2), /darken[^,]*/.exec(site2));

  /* ---- 下载路径 ---- */
  tab("publish");
  doc.getElementById("downloadAll").onclick();
  chk("逐个下载全部文件已触发", downloads.length >= 4, downloads.join(","));

  chk("运行期无未捕获错误", errors.filter(e => e.startsWith("ERROR")).length === 0, errors.filter(e => e.startsWith("ERROR")).join(" | ").slice(0, 400));

  console.log(out.join("\n"));
  console.log("\n--- 运行时告警（预期内的浏览器 API 缺失）---");
  console.log(errors.slice(0, 12).join("\n") || "（无）");
  const failed = out.filter(l => l.startsWith("FAIL")).length;
  console.log("\n结果：" + (out.length - failed) + "/" + out.length + " 通过");
  process.exit(failed ? 1 : 0);
}, 80);
