console.groupCollapsed("\n%c  %c考试时钟 ExamClock", "background:url('/gvbhj111/xwyz-exam-clock/edit/main/js/favicon.ico') no-repeat;padding:32px;", "font:bold 36px sans-serif;color:#3a9;");
console.log("\n项目仓库：https://github.com/L33Z22L11/ExamClock\n野生技协群：894656456\n\n");
console.groupEnd();
/* 
 * 适用于宣威一中的考试科目列表
 */

let specialDate = {
  cee25: parseInt((new Date(2025, 5, 8) - Date.now()) / 864E5),
}

exams["2022-05-14"] = {
  type: "临时考练",
  mainSlogan: `${specialDate.cee22}天后 峰顶相会`,
  schedule() {
    $("考练", today.date, "22:30", "23:30");
  }
};

exams[25] = {
  type: "高三·日常",
  author: "招募“高三·日常”维护者",
  origin: "高三年级部",
  mainSlogan: `距离高考${specialDate.cee25}天`,
  rollSlogan: ["以梦为马，不负韶华。冲刺高考，加油少年！"],
  earlyAdmit: 2,
  schedule() {
     $("早读", today.date, "07:10", "07:40");
    $("第1节", today.date, "07:50", "08:30");
    $("第2节", today.date, "08:40", "09:20");
    $("第3节", today.date, "09:30", "10:10");
    $("课间操", today.date, "10:20", "10:30");
    $("第4节", today.date, "10:35", "11:15");
    $("第5节", today.date, "11:25", "12:05");
    $("第6节", today.date, "14:45", "15:25");
    $("第7节", today.date, "15:35", "16:15");
    $("第8节", today.date, "16:30", "17:10");
    $("小检测", today.date, "17:40", "18:30");
    $("第9节", today.date, "18:50", "19:35");
    $("第10节", today.date, "19:45", "20:30");
    $("第11节", today.date, "20:40", "21:25");
    $("自习", today.date, "21:50", "22:30");
  }
};

exams[251] = {
  type: "高三·物理",
  author: "来源:暂无",
  origin: "高三年级部",
  rollSlogan: ["曲靖市第一次质量检测（暂无）：请以实际铃声为准。"],
  schedule() {
    $("语文", "2024-12-20", "09:00", "11:30");
    $("数学", "2024-12-20", "15:00", "17:00");
    $("物理", "2024-12-21", "09:00", "10:15");
    $("外语", "2024-12-21", "15:00", "17:00");
    $("化学", "2024-12-22", "08:30", "09:45");
    $("地理", "2024-12-22", "11:00", "12:15");
    $("政治", "2024-12-22", "14:30", "15:45");
    $("生物", "2024-12-22", "17:00", "18:15");
  }
};

exams[252] = {
  type: "高三·历史",
  author: "来源:暂无",
  origin: "高三年级部",
  rollSlogan: ["曲靖市第一次质量检测（暂无）：请以实际铃声为准。"],
  schedule() {
    $("语文", "2024-12-20", "09:00", "11:30");
    $("数学", "2024-12-20", "15:00", "17:00");
    $("历史", "2024-12-21", "09:00", "10:15");
    $("外语", "2024-12-21", "15:00", "17:00");
    $("化学", "2024-12-22", "08:30", "09:45");
    $("地理", "2024-12-22", "11:00", "12:15");
    $("政治", "2024-12-22", "14:30", "15:45");
    $("生物", "2024-12-22", "17:00", "18:15");
  }
};

exams[253] = {
  type: "高三·模考",
  author: "",
  origin: "高三年级部",
  rollSlogan: ["高三合格性模拟考试：请以实际铃声为准。"],
  schedule() {
    $("数学", today.date, "07:30", "09:00");
    $("语文", today.date, "09:20", "10:50");
    $("化/史", today.date, "11:10", "12:10");
    $("英语", today.date, "14:25", "15:55");
    $("政治", today.date, "16:15", "17:15");
    $("物理", today.date, "17:35", "18:35");
  }
};

exams[26] = {
  type: "高二日常",
  author: "来源:灵亡",
  origin: "高一年级部",
  mainSlogan: "以梦为马，不负韶华。",
  rollSlogan: ["自立·自治·自觉·自动"],
  schedule() {
    $("早读", today.date, "07:10", "07:40");
    $("第1节", today.date, "07:50", "08:30");
    $("第2节", today.date, "08:40", "09:20");
    $("第3节", today.date, "09:30", "10:10");
    $("课间操", today.date, "10:20", "10:30");
    $("第4节", today.date, "10:35", "11:15");
    $("第5节", today.date, "11:25", "12:05");
    $("第6节", today.date, "14:45", "15:25");
    $("第7节", today.date, "15:35", "16:15");
    $("第8节", today.date, "16:30", "17:10");
    $("小检测", today.date, "17:40", "18:30");
    $("第9节", today.date, "18:50", "19:35");
    $("第10节", today.date, "19:45", "20:30");
    $("第11节", today.date, "20:40", "21:25");
    $("自习", today.date, "21:50", "22:30");
  }
};

exams[261] = {
  type: "高二·物理",
  author: "来源:暂无",
  origin: "2026届年级部",
  rollSlogan: ["宣威市高二年级期末考试：请以实际铃声为准。"],
  schedule() {
    $("语文", "2025-01-13", "07:40", "10:10");
    $("生物", "2025-01-13", "10:40", "12:10");
    $("英语", "2025-01-13", "14:10", "16:10");
    $("地理", "2025-01-13", "16:40", "18:10");
    $("数学", "2025-01-14", "08:00", "10:00");
    $("政治", "2025-01-14", "10:30", "12:00");
    $("化学", "2025-01-14", "14:10", "15:40");
    $("物史", "2025-01-14", "16:10", "17:40");
  }
};

exams[262] = {
  type: "高二·历史",
  author: "来源:暂无",
  origin: "2026届年级部",
  rollSlogan: ["宣威市高二年级期末考试：请以实际铃声为准。"],
  schedule() {
    $("语文", "2025-01-13", "07:40", "10:10");
    $("生物", "2025-01-13", "10:40", "12:10");
    $("英语", "2025-01-13", "14:10", "16:10");
    $("地理", "2025-01-13", "16:40", "18:10");
    $("数学", "2025-01-14", "08:00", "10:00");
    $("政治", "2025-01-14", "10:30", "12:00");
    $("化学", "2025-01-14", "14:10", "15:40");
    $("物史", "2025-01-14", "16:10", "17:40");
  }
};

exams[27] = {
  type: "高一日常",
  author: "来源:灵亡",
  origin: "高一年级部",
  mainSlogan: "以梦为马，不负韶华。",
  rollSlogan: ["自立·自治·自觉·自动"],
  schedule() {
    $("早读", today.date, "07:10", "07:40");
    $("第1节", today.date, "07:50", "08:30");
    $("第2节", today.date, "08:40", "09:20");
    $("第3节", today.date, "09:30", "10:10");
    $("课间操", today.date, "10:20", "10:30");
    $("第4节", today.date, "10:35", "11:15");
    $("第5节", today.date, "11:25", "12:05");
    $("第6节", today.date, "14:45", "15:25");
    $("第7节", today.date, "15:35", "16:15");
    $("第8节", today.date, "16:30", "17:10");
    $("小检测", today.date, "17:40", "18:30");
    $("第9节", today.date, "18:50", "19:35");
    $("第10节", today.date, "19:45", "20:30");
    $("第11节", today.date, "20:40", "21:25");
    $("自习", today.date, "21:50", "22:30");
  }
};
exams[271] = {
  type: "高一·物理",
  author: "来源:高一年级",
  origin: "高一年级部",
  rollSlogan: ["宣威一中高一下第一次月考：请以实际时间为准。"],
  schedule() {
    $("英语", "2025-03-27", "15:00", "17:00");
    $("生物", "2025-03-27", "18:20", "19:35");
    $("物理", "2025-03-27", "20:00", "21:15");
    $("语文", "2025-03-28", "09:30", "12:00");
    $("数学", "2025-03-28", "15:00", "17:30");
    $("化学", "2025-03-28", "20:00", "21:15");
};

exams[272] = {
  type: "高一·历史",
  author: "来源:暂无",
  origin: "2027届年级部",
  rollSlogan: ["宣威市高二年级期末考试：请以实际铃声为准。"],
  schedule() {
    $("语文", "2025-01-13", "07:40", "10:10");
    $("生物", "2025-01-13", "10:40", "12:10");
    $("英语", "2025-01-13", "14:10", "16:10");
    $("地理", "2025-01-13", "16:40", "18:10");
    $("数学", "2025-01-14", "08:00", "10:00");
    $("政治", "2025-01-14", "10:30", "12:00");
    $("化学", "2025-01-14", "14:10", "15:40");
    $("物史", "2025-01-14", "16:10", "17:40");
  }
};

exams[273] = {
  type: "高一·周考",
  author: "来源:灵亡",
  origin: "高一年级部",
  mainSlogan: "以梦为马，不负韶华。",
  rollSlogan: ["自立·自治·自觉·自动"],
  schedule() {
    $("早读", today.date, "08:00", "08:30");
    $("第1节", today.date, "08:40", "10:00");
    $("第2节", today.date, "10:20", "11:30");
    $("第3节", today.date, "14:00", "15:30");
    $("第4节", today.date, "15:40", "16:30");
    $("第5节", today.date, "16:30", "17:20");
    $("第6节", today.date, "19:20", "19:50");
    $("第7节", today.date, "20:00", "20:50");
    $("第8节", today.date, "21:00", "21:50");
    $("提交作业", today.date, "22:00", "22:20");
  }
};

exams[301] = {
  type: "研究生",
  author: "whatever",
  origin: "公共服务",
  rollSlogan: ["研究生初试模拟：公共服务。"],
  schedule() {
    $("上午", today.date, "08:30", "11:30");
    $("下午", today.date, "14:00", "17:00");
  }
};

