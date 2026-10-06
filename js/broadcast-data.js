/*
 * 考试广播配置（Broadcast Rules）
 * 由考试时钟管理控制台生成 · 2026/10/6 10:36:38
 * 后台可视化编辑生成，可直接手工修改。
 */
window.BROADCAST_CONFIG = {
  "version": "1.0.0",
  "settings": {
    "enabled": true,
    "voice": true,
    "rate": 1,
    "pitch": 1,
    "volume": 1,
    "voiceName": "Microsoft Xiaoxiao (Natural) - Chinese (Simplified, China)",
    "lang": "zh-CN",
    "minGapSeconds": 6,
    "repeatGapSeconds": 20,
    "showBanner": true,
    "notify": true,
    "historyLimit": 120,
    "chime": true,
    "chimeFile": "",
    "customAudio": "",
    "customAudioName": "",
    "customAudioVolume": 1,
    "customAudioBeforeVoice": true,
    "pollSeconds": 15
  },
  "exam": {
    "enabled": true,
    "mutedTypes": [
      "25",
      "26",
      "27",
      "261",
      "262",
      "271",
      "272",
      "273",
      "301",
      "302",
      "2022-05-14"
    ],
    "beforeStart": [
      30,
      15,
      5
    ],
    "afterStart": [
      15,
      30
    ],
    "beforeEnd": [
      30,
      15,
      5,
      1
    ],
    "afterEnd": true,
    "templates": {
      "beforeStart": "距离{subject}开考还有{minutes}分钟，请考生尽快入场，按座位号就座。",
      "start": "{subject}考试现在开始，请考生认真审题、规范作答。",
      "afterStart": "{subject}考试已经开始{minutes}分钟，请注意把握答题节奏。",
      "beforeEnd": "距离{subject}考试结束还有{minutes}分钟，请检查答题卡、姓名与考号。",
      "end": "{subject}考试结束，请考生立即停止作答，将答题卡放在桌面，等待监考老师收卷。"
    }
  },
  "clock": {
    "enabled": false,
    "minutes": [
      0,
      30
    ],
    "onlyDuringExam": true,
    "template": "现在时间是{time}。"
  },
  "discipline": {
    "enabled": false,
    "everyMinutes": 30,
    "onlyDuringExam": true,
    "items": [
      "请考生保持考场安静，不得交头接耳、左顾右盼。",
      "请考生将手机等电子设备关机并放到指定位置。",
      "考试期间请勿提前交卷，如有问题请举手示意监考老师。"
    ]
  },
  "timeSync": {
    "enabled": false,
    "url": "https://worldtimeapi.org/api/timezone/Asia/Shanghai",
    "field": "datetime",
    "offsetMs": 0
  },
  "feedBranch": "main"
};
