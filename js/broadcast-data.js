/*
 * 考试广播配置（Broadcast Rules）
 * ------------------------------------------------------------------
 * 后台"广播"页可视化编辑，也可直接改本文件。
 * 所有规则都是"到点自动朗读 + 页面提示"，纯前端定时实现，
 * 无需服务器、无需 WebSocket，静态托管即可运行。
 * ------------------------------------------------------------------
 */
window.BROADCAST_CONFIG = {
  version: "1.0.0",

  /* 总开关与朗读设置 */
  settings: {
    enabled: true,
    voice: true,                 // 开启语音播报
    rate: 1,                     // 语速 0.5 - 2
    pitch: 1,                    // 音调 0 - 2
    volume: 1,                   // 音量 0 - 1
    voiceName: "",               // 指定语音（留空自动选择中文语音）
    lang: "zh-CN",
    minGapSeconds: 6,            // 两条广播之间的最小间隔，避免叠加
    repeatGapSeconds: 20,        // 同一条短时间重复播报的保护间隔
    showBanner: true,            // 页面顶部横幅
    notify: false,               // 系统通知（需用户授权）
    historyLimit: 120,           // 本地保留的播报记录条数
    chime: true,                 // 播报前的提示音
    chimeFile: "",               // 自定义提示音 URL（留空使用内置合成音）
    pollSeconds: 15              // 在线广播源轮询间隔
  },

  /* 考试节点自动播报。{n} 会被替换为分钟数 */
  exam: {
    enabled: true,
    /* 单独关闭某些考试类型的自动播报：
       examMuted 里填 exams 的键（如 251、25、302），后台"自动播报"页可勾选 */
    mutedTypes: [],
    beforeStart: [30, 15, 5],    // 开考前 N 分钟
    afterStart: [15, 30],        // 开考后 N 分钟（剩余时间提示）
    beforeEnd: [30, 15, 5, 1],   // 结束前 N 分钟
    afterEnd: true,              // 结束时刻
    templates: {
      beforeStart: "距离{subject}开考还有{minutes}分钟，请考生尽快入场，按座位号就座。",
      start: "{subject}考试现在开始，请考生认真审题、规范作答。",
      afterStart: "{subject}考试已经开始{minutes}分钟，请注意把握答题节奏。",
      beforeEnd: "距离{subject}考试结束还有{minutes}分钟，请检查答题卡、姓名与考号。",
      end: "{subject}考试结束，请考生立即停止作答，将答题卡放在桌面，等待监考老师收卷。"
    }
  },

  /* 整点/半点报时（考试期间显示考场的学校很实用） */
  clock: {
    enabled: false,
    minutes: [0, 30],
    template: "现在时间是{time}。",
    onlyDuringExam: true
  },

  /* 考场纪律轮播（每隔 N 分钟播报一条） */
  discipline: {
    enabled: false,
    everyMinutes: 30,
    onlyDuringExam: true,
    items: [
      "请考生保持考场安静，不得交头接耳、左顾右盼。",
      "请考生将手机等电子设备关机并放到指定位置。",
      "考试期间请勿提前交卷，如有问题请举手示意监考老师。"
    ]
  },

  /* 时间矫正（教室大屏可能走时，用服务器时间校准） */
  timeSync: {
    enabled: false,
    url: "https://worldtimeapi.org/api/timezone/Asia/Shanghai",
    field: "datetime",
    offsetMs: 0
  }
};
