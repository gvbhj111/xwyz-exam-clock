/* 
 * 页面交互
 */

var eleFullscreen = document.getElementById("fullscreen");

// 全屏
function fullscreen() {
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      eleFullscreen.setAttribute("class", "fa-solid fa-expand");
      eleFullscreen.setAttribute("data-sub", "全屏");
    } else {
      document.documentElement.requestFullscreen();
      eleFullscreen.setAttribute("class", "fa-solid fa-compress");
      eleFullscreen.setAttribute("data-sub", "退出");
    }
  } catch (e) { console.warn(send("操作失败，请手动最大化窗口或全屏。<span class='dim'>建议使用Chrome/Edge/Firefox浏览器。</span>\n") + e); }
}

function sendFeatureRemoved(shield) {
  send(`哥们就写点代码，别给哥们找麻烦。
  <span class="shield">${shield}</span>
  <p class="dim">哥们2021年4月开始做这个项目，现在都三年多了，目前靠几个学弟更新考试时间。你说你玩心重，想改考试时钟大标语，哥们当年费大劲写堆代码，现在告状到我这边，哥们又得删删补补。要是真对网页感兴趣，别图一时修改爽快，建议来维护项目，看看能干几年。</p>
  `);
}

// 语音提醒控制模块
const VoiceReminder = {
  enabled: true,
  enforceWhitelist: true,
  whitelist: ['251', '253', '261', '262', '271', '272'],
  settings: {
    pre30: false,
    pre25: false,
    pre20: true,
    pre15: false,
    pre10: true,
    pre5: false,
    start: false,
    preend15: true,
    end: true
  },

  // 检查当前考试类型是否在白名单中
  isWhitelisted(examType) {
    return this.whitelist.includes(String(examType));
  },
  
  // 初始化菜单
  initMenu() {
    const container = document.getElementById('voice-reminder-container');
    container.innerHTML = `
      <div class="voice-reminder-card">
        <div class="voice-reminder-header">
          <i class="fa-solid fa-bell"></i>
          <span>语音提醒设置</span>
        </div>
        
        <div class="voice-reminder-switch">
          <label>
            <input type="checkbox" id="voice-reminder-toggle" 
                   onchange="VoiceReminder.toggle(this.checked)" 
                   ${this.enabled ? 'checked' : ''}>
            <span class="slider"></span>
            <span class="voice-reminder-label">启用语音提醒</span>
          </label>
        </div>
        
        <div class="voice-reminder-buttons">
          <button class="voice-reminder-btn" onclick="window.open('voice-config.html', 'VoiceReminderConfig', 'width=600,height=500')">
            <i class="fa-solid fa-sliders"></i>
            <span>提醒配置</span>
          </button>
          <button class="voice-reminder-btn" onclick="window.open('audio-config.html', 'AudioConfig', 'width=600,height=600')">
            <i class="fa-solid fa-volume-high"></i>
            <span>音频配置</span>
          </button>
        </div>
        
        <div class="voice-reminder-footer">
          <i class="fa-solid fa-circle-info"></i>
          <span>适用考试类型: ${this.whitelist.join(', ')}</span>
        </div>
      </div>
    `;
  },
  
  // 切换总开关
  toggle(state) {
    console.log(`[VoiceReminder] 用户切换总开关: ${state ? '启用' : '禁用'}`);
    this.enabled = state;
    EC.toggleAudio(state);
    console.log(`[VoiceReminder] 音频系统已${state ? '激活' : '停用'}`);
  },
  
  // 播放语音提醒
  playReminder(type) {
    if (!this.enabled) return;
    
    const reminderText = {
      pre30: '考前30分钟提醒',
      pre20: '考前20分钟提醒',
      pre10: '考前10分钟提醒',
      preend15: '结束前15分钟提醒',
      end: '考试结束提醒'
    }[type] || type;
    
    console.log(`[VoiceReminder] 正在播放语音提醒: ${reminderText}`);
    console.log(`[VoiceReminder] 当前考试类型: ${subject.current || '未设置'}`);
    
    // 实际播放逻辑...
    EC.playAudio(type);
  },
  
  // 更新设置并保存到localStorage
  updateSetting(key, value) {
    console.log(`[VoiceReminder] 更新提醒设置 ${key}: ${value}`);
    this.settings[key] = value;
    // 保存到localStorage
    try {
      localStorage.setItem('voiceReminderSettings', JSON.stringify(this.settings));
      console.log('[VoiceReminder] 设置已持久化到本地存储');
    } catch (e) {
      console.warn('[VoiceReminder] 保存设置失败:', e);
    }
  },

  // 从localStorage加载设置
  loadSettings() {
    try {
      const saved = localStorage.getItem('voiceReminderSettings');
      if (saved) {
        this.settings = JSON.parse(saved);
      }
      // 读取白名单与开关
      const wl = localStorage.getItem('voiceReminderWhitelist');
      if (wl) {
        try { const arr = JSON.parse(wl); if (Array.isArray(arr)) this.whitelist = arr.map(String); } catch(_) {}
      }
      const enforce = localStorage.getItem('voiceReminderEnforce');
      if (enforce != null) this.enforceWhitelist = enforce !== '0';
    } catch (e) {
      console.warn('加载设置失败:', e);
    }
  }
};

// 初始化时加载保存的设置
console.log('[VoiceReminder] 正在加载本地设置...');
VoiceReminder.loadSettings();
console.log(`[VoiceReminder] 初始化完成，当前状态: ${VoiceReminder.enabled ? '启用' : '禁用'}`);
console.log(`[VoiceReminder] 白名单模式: ${VoiceReminder.enforceWhitelist ? '启用' : '禁用'}`);
console.log(`[VoiceReminder] 适用考试类型: ${VoiceReminder.whitelist.join(', ')}`);
// 初始化语音提醒模块
VoiceReminder.initMenu();

// 自定义背景对话框
EC.openCustomBackgroundDialog = function() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const id = addCustomBackground('upload', { file });
      if (id) {
        playCover(bg('custom'));
        alert('背景上传成功！');
      }
    }
  };
  input.click();
};

EC.openURLBackgroundDialog = function() {
  const url = prompt('请输入图片URL:', 'https://example.com/image.jpg');
  if (url) {
    const id = addCustomBackground('url', { url });
    if (id) {
      playCover(bg('custom-url'));
      alert('背景设置成功！');
    }
  }
};

// 监听来自配置页的消息，实时更新设置并持久化（同时兼容 storage 事件）
try {
  window.addEventListener('message', (e) => {
    const data = e && e.data;
    if (data && data.type === 'VOICE_REMINDER_CONFIG_UPDATE' && data.config) {
      VoiceReminder.settings = data.config;
      try { localStorage.setItem('voiceReminderSettings', JSON.stringify(VoiceReminder.settings)); } catch(_){}
      console.log('[VoiceReminder] 已应用来自配置页的更新');
      // 强制刷新当前考试状态以立即应用新设置
      if (subject.current) subject.switch(subject.current);
    }
  });
  window.addEventListener('storage', (e) => {
    if (e && e.key === 'voiceReminderSettings' && e.newValue) {
      try { VoiceReminder.settings = JSON.parse(e.newValue); } catch(_){}
      console.log('[VoiceReminder] 已应用来自 storage 的更新');
      // 强制刷新当前考试状态以立即应用新设置
      if (subject.current) subject.switch(subject.current);
    }
  });
} catch(_){}
