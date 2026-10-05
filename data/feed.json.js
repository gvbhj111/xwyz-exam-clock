/*
 * 广播数据（Exam Broadcast Feed）
 * ------------------------------------------------------------------
 * 这是"考试广播"的默认数据文件，静态托管即可使用。
 *
 * 每位管理员都可以直接编辑本文件：
 *   { id, at, level, text, announce, voice, until, source, pin }
 *     id      唯一标识（不重复即可，重新广播请换新 id）
 *     at      生效时间，ISO 字符串，留空表示"始终生效"
 *     until   失效时间，ISO 字符串，留空表示不过期
 *     level   info | notice | important | urgent
 *     text    广播正文（支持简单 HTML）
 *     voice   朗读文本，留空则朗读 text（去除标签）
 *     announce "slot"（按考试节点自动播报）或留空（仅展示）
 *     pin     true 时固定展示，不进入自动消失队列
 * ------------------------------------------------------------------
 */
window.BROADCAST_DATA = {
  version: "1.0.0",
  updated: "2026-01-01",
  messages: [
    // {
    //   id: "demo-0001",
    //   at: "",
    //   until: "",
    //   level: "notice",
    //   text: "宣威一中考试时钟已升级：支持背景轮播、考试广播与后台管理。",
    //   voice: "考试时钟已升级，支持背景轮播、考试广播与后台管理。",
    //   announce: "",
    //   pin: false,
    //   source: "广播中心"
    // }
  ]
};
