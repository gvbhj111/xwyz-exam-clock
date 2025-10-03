/* 
 * 时间更新
 */

// 这里可以修改today.date
// 测试结束后一定要删除测试数据
// 否则“今天”就是today.date
let today = new Date;

today = {
  date: today.getFullYear() + "-" + fixDigit(today.getMonth() + 1) + "-" + fixDigit(today.getDate()),
  week: parseInt((today - new Date(2022, 1, 6)) / 6048E5),
  day: today.getDay(),
  weekday: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][today.getDay()],
  // 夏季作息：5月1日~9月30日
  isSummer: today.getMonth() > 3 && today.getMonth() < 9
};
console.log(today);

// 各个对象内置功能
let subject = {
  get name() { return document.getElementById("subject").innerHTML; },
  set name(name) { document.getElementById("subject").innerHTML = name; },
  get duration() {
    if (now > this.end) return "";
    return getClock(this.start) + "~" + getClock(this.end);
  },
  set duration(duration) { document.getElementById("duration").innerHTML = duration; },
  // get _start() { },
  // set _start(start) { },
  // get _end() { },
  // set _end(end) { },
};

let exams = {};

let slogan = {
  // 这块有机会再写
};

let timer = {
  // 这块也一样，有机会再写
  _phase: "idle" // 相位跟踪，避免重复触发音频
};

/* 语音与导入：全局控制器 */
const EC = {
  enabled: true,
  customAudioURL: null,
  audioCtx: null,
  customMap: {},
  beepBase: "./radio/",
  _beepCache: {},
  _previewApprovedMap: {},
  // 预留音频文件命名格式（全部内置默认音频，统一为 .mp3）
  defaultReminders: {
    pre30: "pre30.mp3",
    pre25: "pre25.mp3",
    pre20: "pre20.mp3",
    pre15: "pre15.mp3",
    pre10: "pre10.mp3",
    pre5:  "pre5.mp3",
    start: "start.mp3",
    preend15: "preend15.mp3",
    end: "end.mp3"
  },
  setCustomAudio(file) {
    if (!file) { this.clearCustomAudio(); return; }
    if (this.customAudioURL) URL.revokeObjectURL(this.customAudioURL);
    this.customAudioURL = URL.createObjectURL(file);
    // 预热创建 Audio 实例
    this._audio = new Audio(this.customAudioURL);
    // 首次导入自定义音频后，要求先预览确认
    this._previewApproved = false;
  },
  clearCustomAudio() {
    if (this.customAudioURL) URL.revokeObjectURL(this.customAudioURL);
    this.customAudioURL = null;
    this._audio = null;
  },
  toggleAudio(on) {
    this.enabled = !!on;
    if (this.enabled && !this.audioCtx) {
      try {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.audioCtx.state === "suspended") this.audioCtx.resume().catch(()=>{});
      } catch (e) { console.warn("AudioContext 初始化失败：", e); }
    }
  },
  preview() {
    // 仅用于手动预览并解锁后续自动播放
    if (this.customAudioURL && this._audio) {
      try {
        this._audio.currentTime = 0;
        this._audio.play().then(()=>{ this._previewApproved = true; }).catch(()=>{});
      } catch (_) {}
      return;
    }
    // 无自定义音频时预览蜂鸣音
    this._previewApproved = true;
    this._beep('start');
  },
  // 优先播放本地radio目录的默认音频，失败则回退到振荡器蜂鸣
  _beep(kind){
    const fileMap = { admit: "admit.mp3", start: "start.mp3", warn: "warn.mp3", end: "end.mp3" };
    const base = this.beepBase || "./radio/";
    const src = base + (fileMap[kind] || "warn.mp3");
    try {
      let a = this._beepCache[src];
      if (!a) { a = new Audio(src); this._beepCache[src] = a; }
      a.currentTime = 0;
      a.play().catch(()=>{ this._beepOsc(kind); });
    } catch (_) { this._beepOsc(kind); }
  },
  _beepOsc(kind){
    const freqMap = { admit: 660, start: 880, warn: 520, end: 440 };
    const durMap = { admit: .15, start: .25, warn: .12, end: .2 };
    try {
      if (!this.audioCtx) this.toggleAudio(true);
      const ctx = this.audioCtx;
      if (!ctx) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freqMap[kind] || 600;
      const nowt = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, nowt);
      g.gain.exponentialRampToValueAtTime(0.3, nowt + 0.02);
      const dur = durMap[kind] || 0.15;
      g.gain.exponentialRampToValueAtTime(0.0001, nowt + dur);
      o.connect(g).connect(ctx.destination);
      o.start(nowt);
      o.stop(nowt + dur + 0.02);
    } catch (_) {}
  },
  // 按节点键名优先播放 ./radio/{key}.mp3，不存在再按音色播放，最后回退到蜂鸣
  _beepKey(key){
    try {
      const base = this.beepBase || "./radio/";
      const src1 = base + key + ".mp3";
      let a1 = this._beepCache[src1];
      if (!a1) { a1 = new Audio(src1); this._beepCache[src1] = a1; }
      a1.currentTime = 0;
      a1.play().catch(()=>{
        const kind = this.toneOf ? this.toneOf(key) : "warn";
        this._beep(kind);
      });
    } catch (_) {
      const kind = this.toneOf ? this.toneOf(key) : "warn";
      this._beep(kind);
    }
  },
  play(kind) {
    if (!this.enabled) return;
    // 白名单控制：若启用则依据 VoiceReminder.whitelist
    if (window.VoiceReminder && window.VoiceReminder.enforceWhitelist) {
      const list = window.VoiceReminder.whitelist || [];
      if (!list.includes(String(subject.current))) return;
    }

    // 如已选择自定义音频但未预览确认，不播放任何声音
    if (this.customAudioURL && !this._previewApproved) return;
    // 优先使用自定义音频
    if (this.customAudioURL && this._audio) {
      try {
        this._audio.currentTime = 0;
        this._audio.play().catch(()=>{});
      } catch (_) {}
      return;
    }
    // 退化为蜂鸣音
    this._beep(kind);
  },

  // 为指定节点设置/清除自定义音频
  setCustomAudioFor(key, file) {
    if (!file) { this.clearCustomAudioFor(key); return; }
    try { const old = this.customMap[key]; if (old?.url) URL.revokeObjectURL(old.url); } catch(_) {}
    const url = URL.createObjectURL(file);
    this.customMap[key] = { url, audio: new Audio(url) };
    this._previewApprovedMap[key] = false;
  },
  clearCustomAudioFor(key) {
    const cur = this.customMap[key];
    try { if (cur?.url) URL.revokeObjectURL(cur.url); } catch(_) {}
    delete this.customMap[key];
    delete this._previewApprovedMap[key];
  },
  // 预览指定节点并单独解锁（精简日志并增加失败回退）
  previewFor(key) {
    const itm = this.customMap[key];
    if (itm?.audio) {
      try {
        itm.audio.currentTime = 0;
        itm.audio.play()
          .then(() => { this._previewApprovedMap[key] = true; })
          .catch(() => { this._previewApprovedMap[key] = false; this._beep(this.toneOf(key)); });
      } catch (_) { this._beep(this.toneOf(key)); }
      return;
    }
    this._previewApprovedMap[key] = true;
    this._beepKey(key);
  },
  // 播放指定节点（节点音频优先→通用音频→蜂鸣），精简输出并保证失败回退到蜂鸣
  playNode(key) {
    if (!this.enabled) return;
    // 依据提醒配置开关过滤未启用的节点
    try {
      if (window.VoiceReminder && window.VoiceReminder.settings && window.VoiceReminder.settings[key] === false) return;
    } catch(_) {}
    const itm = this.customMap[key];
    if (itm?.audio) {
      if (!this._previewApprovedMap[key]) return;
      try {
        itm.audio.currentTime = 0;
        itm.audio.play().catch(() => { this._beepKey(key); });
      } catch (_) { this._beepKey(key); }
      return;
    }
    if (this.customAudioURL && this._audio) {
      if (!this._previewApproved) return;
      try {
        this._audio.currentTime = 0;
        this._audio.play().catch(() => { this._beepKey(key); });
      } catch (_) { this._beepKey(key); }
      return;
    }
    this._beepKey(key);
  },

  /* 导入考试数据：支持 JSON/CSV */
  importExamData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || "");
        let data;
        if (file.type.includes("json") || file.name.toLowerCase().endsWith(".json")) {
          data = JSON.parse(text);
        } else {
          data = EC._parseCSV(text);
        }
        const examKey = "local_" + Date.now();
        const meta = {
          type: data.type || "本地导入",
          mainSlogan: data.mainSlogan,
          rollSlogan: data.rollSlogan,
          earlyAdmit: typeof data.earlyAdmit === "number" ? data.earlyAdmit : undefined
        };
        const items = Array.isArray(data.schedule) ? data.schedule : data; // CSV 解析返回数组
        exams[examKey] = {
          type: meta.type,
          mainSlogan: meta.mainSlogan,
          rollSlogan: meta.rollSlogan,
          earlyAdmit: meta.earlyAdmit,
          schedule() {
            items.forEach(it => {
              if (!it) return;
              const name = it.name || it.subject || it.title || "科目";
              const date = it.date || today.date;
              const start = it.start || it.begin;
              const end = it.end || it.finish;
              if (start && end) $(name, date, start, end, meta.mainSlogan, meta.rollSlogan, meta.earlyAdmit);
            });
          }
        };
        // 动态追加入口
        try {
          const a = document.createElement("a");
          a.textContent = meta.type + "（本地）";
          a.onclick = () => subject.switch(examKey);
          document.getElementById("typelist")?.appendChild(a);
        } catch (_) {}
        subject.switch(examKey);
        send && send("已导入本地考试数据并切换：" + meta.type);
      } catch (e) {
        alert("导入失败：" + e);
      }
    };
    reader.readAsText(file, "utf-8");
  },
  _parseCSV(text) {
    // 简单 CSV 解析：按行拆分，首行表头 name,date,start,end
    const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    if (!lines.length) return [];
    const header = lines[0].split(",").map(s=>s.trim());
    const idx = (k)=>header.findIndex(h=>h.toLowerCase()===k);
    const iname = idx("name"); const idate = idx("date"); const istart = idx("start"); const iend = idx("end");
    return lines.slice(1).map(line=>{
      const cells = line.split(",").map(s=>s.trim());
      return {
        name: cells[iname] || "科目",
        date: cells[idate] || today.date,
        start: cells[istart],
        end: cells[iend]
      };
    }).filter(x=>x.start && x.end);
  }
};

EC.profile = 'custom';
EC.profiles = {
  custom: [
    { key: 'pre30',    t: (s) => new Date(s.start - 30 * 60000) }, // 考前30分钟
    { key: 'pre25',    t: (s) => new Date(s.start - 25 * 60000) }, // 考前25分钟
    { key: 'pre20',    t: (s) => new Date(s.start - 20 * 60000) }, // 考前20分钟
    { key: 'pre15',    t: (s) => new Date(s.start - 15 * 60000) }, // 考前15分钟
    { key: 'pre10',    t: (s) => new Date(s.start - 10 * 60000) }, // 考前10分钟
    { key: 'pre5',     t: (s) => new Date(s.start -  5 * 60000) }, // 考前5分钟
    { key: 'start',    t: (s) => new Date(s.start) },              // 开始时
    { key: 'preend15', t: (s) => new Date(s.end -  15 * 60000) },  // 结束前15分钟
    { key: 'end',      t: (s) => new Date(s.end) }                 // 结束
  ]
};
EC.toneOf = (key) => ({
  pre30: 'admit',
  pre25: 'admit',
  pre20: 'admit',
  pre15: 'warn',
  pre10: 'warn',
  pre5:  'warn',
  start: 'start',
  preend15: 'warn',
  end: 'end'
}[key] || 'warn');

subject.switch = function (type) {
  if (!(type in exams))
    return send(`没有${type}考试类型，切换失败。`);
  // 切换类型时需要重置的内容
  if (SP.debug) now = new Date(0);
  this.name = "";
  this.start = this.end = new Date(0);

  this.current = type;
  this.$admit = exams[type].earlyAdmit || 20;
  timer.progress = slogan.main = slogan.roll = slogan.subnum = 0;
  slogan.$main = exams[type].mainSlogan || "沉着冷静&emsp;诚信考试";
  slogan.$roll = exams[type].rollSlogan || [""];
  exams[this.current].schedule();
  slogan.update();
  document.getElementById("type").innerHTML = exams[this.current].type;
  // 重置语音提醒状态
  timer._phase = "idle";
  timer._fired = {};
  // 切换时播放默认提示音，并在短时间内屏蔽节点提醒
  try { EC._beep('start'); } catch(_) {}
  EC._suppressUntil = Date.now() + 10000;

  if (SP.debug == null) playCover();
  // document.getElementsByClassName("card")[0].style.filter = "blur(.5em)";
  // 想提升应用启动速度，就把延迟改小点
  setTimeout(function () {
    // document.getElementsByClassName("card")[0].style.filter = "blur(0)";
    timer.update();
    slogan.update();
  }, 500);
}
// 设置临时科目
function setTemp(ts, sh, sm, eh, em) {
  subject.end = new Date(0);
  if (!(ts = prompt("考试科目名称(3个字以内)", "考练")) ||
    !(sh = prompt("考试开始时间(小时)", 16)) ||
    !(sm = prompt("考试开始时间(分钟)", 25)) ||
    !(eh = prompt("考试结束时间(小时)", 23)) ||
    !(em = prompt("考试结束时间(分钟)", 55)))
    // 取消创建临时科目
    return console.warn(send("由于操作取消，未生成临时科目。"));
  // 成功创建临时科目
  $(ts, today.date, fixDigit(sh) + ":" + fixDigit(sm), fixDigit(eh) + ":" + fixDigit(em));
  console.log(send("添加了一门在 " + today.date + " 从 " + getClock(subject.start) + " 到 " + getClock(subject.end) + " 的科目：" + ts));
  if (subject.end < now) console.log(send("设置的结束时间小于当前时间，你是认真的吗？"));
}
// 分钟倒计时 by 加零
function setTimer(min) {
  subject.end = new Date(0);
  if (!(min = prompt("倒计时分钟数", 20)))
    return console.warn(send("由于操作取消，未生成临时科目。"));
  let end = new Date(now);
  end.setMinutes(end.getMinutes() + +min);
  $("⏱️", today.date, fixDigit(now.getHours()) + ":" + fixDigit(now.getMinutes()), fixDigit(end.getHours()) + ":" + fixDigit(end.getMinutes()));
  console.log(send("添加了一个 " + today.date + " 从 " + getClock(subject.start) + " 到 " + getClock(subject.end) + " 的倒计时"));
  if (end < now) console.log(send("编写本功能的加零提示：时光无法回溯……"));
}
/**
@brief 注入科目信息
@param toSubject 科目名称
@param toDate 日期（格式为 yyyy-mm-dd）
@param toStart 开始时间（格式为 hh:mm）
@param toEnd 结束时间（格式为 hh:mm）
@param toMainslogan 大标语
@param toRollslogan 小标语
@param toAdmit 提前入场分钟数，默认为exams对象中的$admit
*/
function $(toSubject, toDate, toStart, toEnd, toMainslogan, toRollslogan, toAdmit) {
  if (now < subject.end) {
    console.log("当前科目未结束，故不注入科目：" + toSubject);
  } else if (now >= new Date(toDate + "T" + toEnd + "+08:00")) {
    console.log("请求科目已结束，故不注入科目：" + toSubject);
  } else {
    subject.name = toSubject;
    // document.getElementById("subject").innerHTML = subject.name;
    subject.start = new Date(toDate + "T" + toStart + "+08:00");
    subject.end = new Date(toDate + "T" + toEnd + "+08:00");
    subject.duration = subject.duration;
    subject.admit = toAdmit != null ? toAdmit : subject.$admit;
    // document.getElementById("duration").innerHTML = subject.duration;
    slogan.main = toMainslogan != null ? toMainslogan : slogan.$main;
    slogan.roll = toRollslogan != null ? toRollslogan : slogan.$roll;
    slogan.update();
    // 啊对对对，有很多种方法将变量转换为数字，我就用最麻烦的
    console.log("[" + new Date + "]\n时钟时间：" + now + "\n注入科目：" + toSubject + "\n开始时间：" + toDate, toStart + "\n结束时间：" + toDate, toEnd + "\n提前入场：" + subject.admit + " min\n" + ["默认大标语：", "指定大标语："][~!toMainslogan + 2] + slogan.main + ["\n默认副标语：", "\n指定副标语："][!!toRollslogan - -0] + slogan.roll);
  }
}
slogan.update = function () {
  this.main = this.main || this.$main;
  document.getElementById("mainslogan").innerHTML = this.main || this.$main;
  this.roll = this.roll || this.$roll;
  this.subnum < this.roll.length - 1 ? this.subnum++ : this.subnum = 0;
  document.getElementById("subslogan").innerHTML = (this.roll || this.$roll)[this.subnum];
}
timer.update = function () {
  document.getElementById("clock").innerHTML = getClock(now);
  if (now >= subject.end) {
    exams[subject.current].schedule();
    subject.duration = subject.duration;
    // document.getElementById("subject").innerHTML = subject.name;
    // document.getElementById("duration").innerHTML = subject.duration;
  }
  // 高考标准节点触发（一次性）
  const prof = EC.profiles && EC.profiles[EC.profile];
  if (prof && subject.start instanceof Date && subject.end instanceof Date && subject.start > new Date(0)) {
    this._fired = this._fired || {};
    for (const n of prof) {
      try {
        const t = n.t(subject);
        // 切换后短时间内屏蔽节点提醒
        if (EC._suppressUntil && Date.now() < EC._suppressUntil) continue;
        // 结束前15分钟：考试总时长不足15分钟，或节点早于开始时间，均不触发
        if (n.key === 'preend15') {
          if ((subject.end - subject.start) < 15 * 60000) { this._fired[n.key] = true; continue; }
          if (t < subject.start) { this._fired[n.key] = true; continue; }
        }
        if (t && now >= t && !this._fired[n.key]) {
          if (window.VoiceReminder && window.VoiceReminder.settings && window.VoiceReminder.settings[n.key] === false) { this._fired[n.key] = true; continue; }
          // 检查语音提醒总开关和白名单
          if (window.VoiceReminder && window.VoiceReminder.enabled && 
              (!window.VoiceReminder.enforceWhitelist || window.VoiceReminder.isWhitelisted(subject.current))) {
            console.log(`[VoiceReminder] 触发节点 ${n.key}`);
            EC.playNode(n.key);
          }
          this._fired[n.key] = true;
        }
      } catch (_) {}
    }
  }

  if (now < (subject.start - subject.admit * 6E4 - 12E5)) {
    this.num = (subject.start - subject.admit * 6E4 - now) / 36E5;
    this.num = this.num.toFixed(this.num >= 10 ? 0 : 1);
    this.roll = "h";
    this.activity = "距离入场";
    this.progress = 0;
  } else if (now < (subject.start - subject.admit * 6E4)) {
    this.num = Math.round((subject.start - now - subject.admit * 6E4) / 6E4);
    this.roll = "min";
    this.activity = "距离入场";
    this.progress = 0;
  } else if (now < subject.start) {
    this.num = Math.round((subject.start - now) / 6E4);
    this.roll = "min";
    this.activity = "距离开始";
    this.progress = (subject.start - now) / subject.admit / 600;
  } else if (now < subject.end) {
    if ((now - subject.start) / (subject.end - subject.start) < 0.5) {
      this.num = Math.round((now - subject.start) / 6E4);
      this.activity = "已经开始";
    } else {
      this.num = Math.round((subject.end - now) / 6E4);
      this.activity = "距离结束";
    }
    this.roll = "min";
    this.progress = (now - subject.start) / (subject.end - subject.start) * 100;
  } else {
    // 结束后的内容
    subject.name = this.num = this.roll = this.activity = "";
    this.progress = 100;
  }
  document.getElementById("bar").style.width = this.progress + "%";
  document.getElementById("timer").innerHTML = this.num;
  document.getElementById("timersub").innerHTML = this.roll;
  document.getElementById("activity").innerHTML = this.activity;
}
// 输入Date对象，返回友好的时间(如"8:00")
function getClock(date) { return date.getHours() + ":" + fixDigit(date.getMinutes()); }
// 以分钟为单位相对调整Date对象的时间
function fixMinutes(date, friendlyname) {
  date.setMinutes(date.getMinutes() + Number(prompt("以分钟为单位增减" + (friendlyname || getClock(date)), -5)));
  document.getElementById("duration").innerHTML = subject.duration;
}
// 在一位数前补“0”
function fixDigit(num) { num = parseInt(num); return num < 10 ? "0" + num : num; }
