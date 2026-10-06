/*
 * 背景数据源配置（Background Data）
 * 由考试时钟管理控制台生成 · 2026/10/6 10:36:36
 * 后台可视化编辑生成，可直接手工修改。
 */
window.BG_DATA = {
  "settings": {
    "enabled": true,
    "intervalSeconds": 120,
    "order": "random",
    "transition": "fade",
    "transitionMs": 1200,
    "kenBurns": true,
    "effect": "none",
    "darken": 50,
    "focus": "center center",
    "showCaption": true,
    "pauseWhileHidden": true,
    "avoidRepeat": 2,
    "weightMode": "perSource"
  },
  "items": [
    {
      "id": "gallery-all",
      "type": "gallery",
      "name": "一卷图库（全量 23 卷 / 542 张）",
      "weight": 10,
      "enabled": true,
      "license": "CC BY-NC-SA 4.0",
      "volumes": []
    },
    {
      "id": "builtin-featured",
      "type": "gallery",
      "name": "宣威一中精选（本地图床）",
      "weight": 4,
      "enabled": true,
      "license": "CC BY-NC-SA 4.0",
      "list": [
        {
          "author": "灵亡",
          "name": "运动会",
          "vol": "精选",
          "url": "https://ooo.0x0.ooo/2025/04/03/O0186Y.jpg"
        },
        {
          "author": "灵亡",
          "name": "运动会2",
          "vol": "精选",
          "url": "https://ooo.0x0.ooo/2025/04/03/O016DU.jpg"
        },
        {
          "author": "灵亡",
          "name": "篮球赛",
          "vol": "精选",
          "url": "https://ooo.0x0.ooo/2025/04/03/O01lSx.jpg"
        },
        {
          "author": "灵亡",
          "name": "大成殿",
          "vol": "精选",
          "url": "https://ooo.0x0.ooo/2025/04/03/O01fAt.jpg"
        },
        {
          "author": "灵亡",
          "name": "运动会3",
          "vol": "精选",
          "url": "https://ooo.0x0.ooo/2025/04/03/O01YqX.jpg"
        },
        {
          "author": "灵亡",
          "name": "宣威夜",
          "vol": "精选",
          "url": "https://ooo.0x0.ooo/2025/04/03/O0NBOt.jpg"
        }
      ]
    },
    {
      "id": "pub-picui",
      "type": "static",
      "name": "公共图床（picui）",
      "weight": 3,
      "list": [
        {
          "author": "picui",
          "name": "启动图 B",
          "url": "https://free.picui.cn/free/2026/07/07/6a4cb8a8e338f.png"
        }
      ],
      "enabled": true
    },
    {
      "id": "picsum",
      "type": "online",
      "name": "Picsum 随机摄影",
      "weight": 5,
      "api": "https://picsum.photos/seed/",
      "suffix": "/1920/1080",
      "author": "Picsum",
      "license": "Unsplash License",
      "enabled": true
    },
    {
      "id": "loremflickr",
      "type": "online",
      "name": "LoremFlickr 主题图",
      "weight": 2,
      "api": "https://loremflickr.com/1920/1080/",
      "topics": [
        "campus",
        "sky",
        "clouds",
        "classroom",
        "nature"
      ],
      "suffix": "",
      "author": "LoremFlickr",
      "license": "CC",
      "enabled": true
    },
    {
      "id": "bing",
      "type": "bing",
      "name": "必应每日壁纸",
      "weight": 6,
      "api": "https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN",
      "base": "https://cn.bing.com",
      "cacheMinutes": 180,
      "fallback": [
        {
          "author": "Bing",
          "name": "每日壁纸 A",
          "url": "https://cn.bing.com/th?id=OHR.BlueCanyon_ZH-CN6846889594_1920x1080.jpg"
        },
        {
          "author": "Bing",
          "name": "每日壁纸 B",
          "url": "https://cn.bing.com/th?id=OHR.GreatBarrierReef_ZH-CN4572073279_1920x1080.jpg"
        },
        {
          "author": "Bing",
          "name": "每日壁纸 C",
          "url": "https://cn.bing.com/th?id=OHR.MontBlanc_ZH-CN9505161127_1920x1080.jpg"
        },
        {
          "author": "Bing",
          "name": "每日壁纸 D",
          "url": "https://cn.bing.com/th?id=OHR.SnowyHills_ZH-CN5560284453_1920x1080.jpg"
        }
      ],
      "enabled": true
    },
    {
      "id": "gradient",
      "type": "gradient",
      "name": "内置渐变",
      "weight": 4,
      "list": [
        {
          "author": "主题",
          "name": "深海",
          "css": "linear-gradient(135deg,#0f2027,#203a43,#2c5364)"
        },
        {
          "author": "主题",
          "name": "暮云",
          "css": "linear-gradient(135deg,#232526,#414345,#7b4397,#dc2430)"
        },
        {
          "author": "主题",
          "name": "晨雾",
          "css": "linear-gradient(135deg,#141e30,#243b55,#4b6cb7,#182848)"
        },
        {
          "author": "主题",
          "name": "青柠",
          "css": "linear-gradient(135deg,#000428,#004e92,#00c9ff,#92fe9d)"
        },
        {
          "author": "主题",
          "name": "玄武",
          "css": "linear-gradient(135deg,#0f0c29,#302b63,#24243e)"
        },
        {
          "author": "主题",
          "name": "紫霞",
          "css": "linear-gradient(135deg,#42275a,#734b6d,#c33764,#1d2671)"
        }
      ],
      "enabled": true
    },
    {
      "id": "solid",
      "type": "solid",
      "name": "纯色底",
      "weight": 1,
      "list": [
        {
          "author": "主题",
          "name": "石墨黑",
          "css": "#1b1d21"
        },
        {
          "author": "主题",
          "name": "讲台绿",
          "css": "#123c2e"
        },
        {
          "author": "主题",
          "name": "夜空蓝",
          "css": "#101a33"
        }
      ],
      "enabled": true
    },
    {
      "id": "video",
      "type": "video",
      "name": "动态视频",
      "weight": 2,
      "list": [
        {
          "author": "Google",
          "name": "云海延时",
          "url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          "poster": ""
        }
      ],
      "enabled": true
    },
    {
      "id": "local-repo",
      "type": "local",
      "name": "仓库图片（./images/）",
      "weight": 3,
      "list": [],
      "enabled": true
    },
    {
      "id": "local-user",
      "type": "local",
      "name": "我的收藏（浏览器本地）",
      "weight": 2,
      "list": [],
      "enabled": true
    }
  ],
  "updated": "2026-10-06"
};
