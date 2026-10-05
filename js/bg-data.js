/*
 * 背景数据源配置（Background Data）
 * ------------------------------------------------------------------
 * 本文件是"自定义背景轮播"的数据层，纯静态、无依赖，可直接被
 * GitHub Pages / Netlify / Vercel / 任意静态服务器托管。
 *
 * 数据结构：
 *   BG_DATA.sources[]  轮播来源（可多选、可加权、可排序）
 *     id      唯一标识
 *     type    gallery | static | bing | online | local | gradient | solid | video | custom
 *     name    显示名称
 *     weight  轮播权重（0 表示不参与随机轮播）
 *     list    静态图片数组 [{ author, name, url, vol }]
 *     topics  在线随机图库分类（兼容 loremflickr / picsum 等）
 *   BG_DATA.settings   轮播行为设置
 *   BG_DATA.items      自定义背景条目（后台"背景"页可直接编辑）
 *
 * 所有 URL 支持相对路径（./xxx.jpg），因此换域名、部署到子目录都不会坏。
 * ------------------------------------------------------------------
 */
(function (global) {
  "use strict";

  /* ============ 内置图库（宣威一中·一卷图库） ============ */
  // 原图床：https://ooo.0x0.ooo/2025/04/03/O01fAt.jpg
  // 这里保存为短码，运行时按需展开，避免重复的域名前缀。
  var BUILTIN_SHORTCODES = [
    ["灵亡", "运动会", "5/04/03/O0186Y"],
    ["灵亡", "运动会2", "5/04/03/O016DU"],
    ["灵亡", "篮球赛", "5/04/03/O01lSx"],
    ["灵亡", "大成殿", "5/04/03/O01fAt"],
    ["灵亡", "运动会3", "5/04/03/O01YqX"],
    ["灵亡", "宣威夜", "5/04/03/O0NBOt"]
  ];

  function expandShort(shortURL) {
    return "https://ooo.0x0.ooo/202" + shortURL + ".jpg";
  }

  /* ============ 在线图床 / 随机图源 ============ */
  // 说明：这些是公开、稳定、免 key 的图片接口；离线或校园网受限时会自动跳过。
  var ONLINE_SOURCES = [
    {
      id: "pub-picui",
      type: "static",
      name: "公共图床（picui）",
      weight: 3,
      list: [
        { author: "picui", name: "启动图 A", url: "https://free.picui.cn/free/2026/07/07/6a4cb8a87163c.png" },
        { author: "picui", name: "启动图 B", url: "https://free.picui.cn/free/2026/07/07/6a4cb8a8e338f.png" }
      ]
    },
    {
      id: "picsum",
      type: "online",
      name: "Picsum 随机摄影",
      weight: 5,
      api: "https://picsum.photos/seed/",
      suffix: "/1920/1080",
      author: "Picsum",
      license: "Unsplash License"
    },
    {
      id: "loremflickr",
      type: "online",
      name: "LoremFlickr 主题图",
      weight: 2,
      api: "https://loremflickr.com/1920/1080/",
      topics: ["campus", "sky", "clouds", "classroom", "nature"],
      suffix: "",
      author: "LoremFlickr",
      license: "CC"
    },
    {
      id: "bing",
      type: "bing",
      name: "必应每日壁纸",
      weight: 6,
      api: "https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=zh-CN",
      base: "https://cn.bing.com",
      cacheMinutes: 180
    }
  ];

  /* ============ 视觉预设（渐变 / 纯色 / 动态视频） ============ */
  var PRESET_SOURCES = [
    {
      id: "gradient",
      type: "gradient",
      name: "内置渐变",
      weight: 4,
      list: [
        { author: "主题", name: "深海", css: "linear-gradient(135deg,#0f2027,#203a43,#2c5364)" },
        { author: "主题", name: "暮云", css: "linear-gradient(135deg,#232526,#414345,#7b4397,#dc2430)" },
        { author: "主题", name: "晨雾", css: "linear-gradient(135deg,#141e30,#243b55,#4b6cb7,#182848)" },
        { author: "主题", name: "青柠", css: "linear-gradient(135deg,#000428,#004e92,#00c9ff,#92fe9d)" },
        { author: "主题", name: "玄武", css: "linear-gradient(135deg,#0f0c29,#302b63,#24243e)" },
        { author: "主题", name: "紫霞", css: "linear-gradient(135deg,#42275a,#734b6d,#c33764,#1d2671)" }
      ]
    },
    {
      id: "solid",
      type: "solid",
      name: "纯色底",
      weight: 1,
      list: [
        { author: "主题", name: "石墨黑", css: "#1b1d21" },
        { author: "主题", name: "讲台绿", css: "#123c2e" },
        { author: "主题", name: "夜空蓝", css: "#101a33" }
      ]
    },
    {
      id: "video",
      type: "video",
      name: "动态视频",
      weight: 2,
      list: [
        {
          author: "Google",
          name: "云海延时",
          url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          poster: ""
        }
      ]
    }
  ];

  /* ============ 用户可达的本地目录（可自行放图） ============ */
  var LOCAL_SOURCES = [
    {
      id: "local-repo",
      type: "local",
      name: "仓库图片（./images/）",
      weight: 3,
      // 后台"背景"页可一键把 bg 目录里的图片登记到这里
      list: []
    },
    {
      id: "local-user",
      type: "local",
      name: "我的收藏（浏览器本地）",
      weight: 2,
      list: []
    }
  ];

  var BG_DATA = {
    version: "1.0.0",
    updated: new Date().toISOString().slice(0, 10),
    settings: {
      enabled: true,          // 是否启用自动轮播
      intervalSeconds: 120,   // 自动切换间隔（秒）
      order: "random",        // random | sequence
      transition: "fade",     // fade | none
      transitionMs: 1200,     // 过渡时长
      kenBurns: true,         // 缓慢缩放动效
      effect: "none",         // none | blur | gray | warm | cool | dark
      darken: 50,             // 遮罩深度 0-90
      focus: "center center", // 背景定位
      showCaption: true,      // 是否在页脚显示当前背景来源
      pauseWhileHidden: true, // 后台标签页暂停轮播
      avoidRepeat: 2          // 最近 N 张不重复
    },
    items: [
      {
        id: "gallery-all",
        type: "gallery",
        name: "一卷图库（全量 23 卷 / 542 张）",
        weight: 10,
        enabled: true,
        license: "CC BY-NC-SA 4.0",
        volumes: []          // 留空表示全部卷；填 ["Nov25","May25"] 可缩小范围
      },
      {
        id: "builtin-featured",
        type: "gallery",
        name: "宣威一中精选（本地图床）",
        weight: 4,
        enabled: true,
        license: "CC BY-NC-SA 4.0",
        list: BUILTIN_SHORTCODES.map(function (row) {
          return { author: row[0], name: row[1], vol: "精选", url: expandShort(row[2]) };
        })
      }
    ].concat(ONLINE_SOURCES, PRESET_SOURCES, LOCAL_SOURCES)
  };

  global.BG_DATA = BG_DATA;
  global.BGUtils = {
    expandShort: expandShort
  };
})(typeof window !== "undefined" ? window : this);
