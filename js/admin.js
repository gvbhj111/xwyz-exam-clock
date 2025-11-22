(function(){
  const USER = 'gvbhj111';
  const PASS = '667755asd';
  const $ = (id)=>document.getElementById(id);
  const log = (msg)=>{ const s = $('status'); if(!s) return; s.textContent += (msg+'\n'); console.log('[Admin]', msg); };

  function generateMathCaptcha() {
    const num1 = Math.floor(Math.random() * 10) + 1;
    const num2 = Math.floor(Math.random() * 10) + 1;
    const operator = ['+', '-', '*'][Math.floor(Math.random() * 3)];
    const expression = `${num1} ${operator} ${num2}`;
    const answer = eval(expression);
    return { expression, answer };
  }

  let currentCaptcha = generateMathCaptcha();
  
  function requireLogin(){
    const u = $('adminUser').value.trim();
    const p = $('adminPass').value;
    const captcha = $('localCaptcha').value.trim();
    
    if (!captcha || parseInt(captcha) !== currentCaptcha.answer) {
      currentCaptcha = generateMathCaptcha();
      $('loginMsg').textContent = `请计算：${currentCaptcha.expression} = ?`;
      return;
    }
    
    if(u === USER && p === PASS){
      $('loginPanel').style.display='none';
      $('adminPanel').style.display='block';
      log('登录成功，已进入管理界面');
      try{
        const encStr = localStorage.getItem('gh_token_enc') || '';
        if(encStr){
          log('检测到本机已保存的密文Token，可输入口令后点击“解密填充Token”');
          if($('ghPass')) $('ghPass').focus();
        }else{
          log('尚未保存密文Token，可输入 Token 与口令后点击“保存加密Token”');
        }
      }catch(_){ /* 忽略 */ }
    }else{
      $('loginMsg').textContent = '账号或密码错误';
    }
  }

  async function loadExam(){
    try{
      if(!/^https?:$/.test(location.protocol)){
        log('当前不在 HTTP(S) 环境，浏览器会阻止从 file:// 读取。可改用“从本地选择 exam.js”加载，或用本地服务器访问。');
      }
      log('尝试加载 ./js/exam.js');
      const res = await fetch('./js/exam.js', {cache:'no-store'});
      if(!res.ok){ throw new Error('HTTP '+res.status); }
      const txt = await res.text();
      $('examEditor').value = txt;
      log('exam.js 已加载到编辑器');
    }catch(e){
      console.error(e);
      log('加载失败: '+e.message+'；可点击右侧文件选择框直接载入本地 exam.js');
    }
  }

  function downloadExam(){
    const content = $('examEditor').value;
    const blob = new Blob([content], {type:'application/javascript'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'exam.js'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
    log('已触发下载 exam.js');
  }

  function b64(str){ return btoa(unescape(encodeURIComponent(str))); }

  async function deriveKey(pass, saltBytes){
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({name:'PBKDF2', salt: saltBytes, iterations:100000, hash:'SHA-256'}, keyMaterial, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
    return key;
  }
  async function encryptToken(token, pass){
    const enc = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await deriveKey(pass, salt);
    const cipher = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, enc.encode(token));
    const out = { iv: Array.from(iv), salt: Array.from(salt), cipher: Array.from(new Uint8Array(cipher)) };
    localStorage.setItem('gh_token_enc', JSON.stringify(out));
    return out;
  }
  async function decryptToken(data, pass){
    const dec = new TextDecoder();
    const iv = new Uint8Array(data.iv||[]);
    const salt = new Uint8Array(data.salt||[]);
    const cipher = new Uint8Array(data.cipher||[]);
    const key = await deriveKey(pass, salt);
    const plainBuf = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, cipher);
    return dec.decode(plainBuf);
  }
  async function saveEncryptedToken(){
    const t = $('ghToken') ? $('ghToken').value.trim() : '';
    const p = $('ghPass') ? $('ghPass').value : '';
    if(!t || !p){ log('请填写 Token 与加密口令'); return; }
    try{ await encryptToken(t, p); $('ghToken').value=''; log('已保存加密Token到本机（localStorage），已清空明文输入'); }
    catch(e){ log('保存加密Token失败：'+e.message); }
  }
  function clearEncryptedToken(){ localStorage.removeItem('gh_token_enc'); log('已清除本机密文'); }
  async function decryptAndFillToken(){
    try{
      const encStr = localStorage.getItem('gh_token_enc') || '';
      const pass = ($('ghPass') && $('ghPass').value) ? $('ghPass').value : '';
      if(!encStr){ log('未发现本机密文，请先保存加密Token'); return; }
      if(!pass){ log('请先输入加密口令'); return; }
      const encObj = JSON.parse(encStr);
      const token = await decryptToken(encObj, pass);
      $('ghToken').value = token;
      log('已使用口令解密并填充 Token');
    }catch(e){ log('解密失败：'+e.message); }
  }
  function toggleVisibility(inputId){
    const el = $(inputId);
    if(!el) return;
    el.type = (el.type==='password') ? 'text' : 'password';
  }
  function importDemoToken(){
    const DEMO = 'demo';
    if($('ghToken')){ $('ghToken').value = DEMO; log('已导入示例Token，请尽快加密保存并清空明文'); }
  }

  async function pushGitHub(){
    const owner = $('ghOwner').value.trim();
    const repo  = $('ghRepo').value.trim();
    const path  = $('ghPath').value.trim() || 'js/exam.js';
    const branch= $('ghBranch').value.trim() || 'main';
    const msg   = $('ghMessage').value.trim() || 'update exam.js via admin';
    let token = $('ghToken').value.trim();
    const content = $('examEditor').value;

    if(!token){
      try{
        const encStr = localStorage.getItem('gh_token_enc') || '';
        const pass = ($('ghPass') && $('ghPass').value) ? $('ghPass').value : '';
        if(encStr && pass){
          const encObj = JSON.parse(encStr);
          token = await decryptToken(encObj, pass);
        }
      }catch(e){ log('口令解密失败：'+e.message); }
    }

    if(!owner || !repo || !path || !token){
      log('参数不完整：请填写仓库信息与 Token（可先保存加密Token，并在使用时输入口令解密）');
      return;
    }
    log(`准备推送到 https://api.github.com/repos/${owner}/${repo}/contents/${path}`);

    try{
      // 先获取当前文件 SHA
      const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
      log('获取当前文件信息以取得 sha...');
      const headRes = await fetch(getUrl, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
      let sha = undefined;
      if(headRes.status === 200){
        const json = await headRes.json();
        sha = json.sha; log('已取得 sha: '+sha);
      }else if(headRes.status === 404){
        log('远程不存在该文件，将创建新文件');
      }else{
        throw new Error('获取 sha 失败，HTTP '+headRes.status);
      }

      const putUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
      const body = { message: msg, content: b64(content), branch };
      if(sha) body.sha = sha;
      log('提交变更中...');
      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      if(!putRes.ok){
        const errTxt = await putRes.text();
        throw new Error('推送失败: HTTP '+putRes.status+' '+errTxt);
      }
      const result = await putRes.json();
      log('推送成功：commit '+(result.commit && result.commit.sha ? result.commit.sha : '未知'));
    }catch(e){
      log('推送过程出错: '+e.message);
    }
  }

  // 本地文件加载备用方案
  function AdminLoadExamFromFile(file){
    if(!file){ log('未选择文件'); return; }
    const reader = new FileReader();
    reader.onload = ()=>{ $('examEditor').value = String(reader.result||''); log('已从本地文件载入 exam.js'); };
    reader.onerror = (e)=>{ console.error(e); log('读取本地文件失败'); };
    reader.readAsText(file, 'utf-8');
  }
  window.AdminLoadExamFromFile = AdminLoadExamFromFile;

  // 绑定事件与验证码结果监听
  document.addEventListener('DOMContentLoaded', ()=>{
    const capEl = $('cap');

    function markCaptchaPassed(token){
      CAPTCHA_OK = true; CAPTCHA_TOKEN = token || CAPTCHA_TOKEN || '';
      $('loginMsg').textContent = '';
      log('验证码通过');
    }

    // 1) 兜底的跨窗口消息监听（若小部件通过 postMessage 通知完成）
    window.addEventListener('message', (e)=>{
      const d = e && e.data;
      if(d && (d.type==='cap' || d.source==='cap') && (d.status==='success' || d.verified===true)){
        markCaptchaPassed(d.token || '');
        log('验证码通过（postMessage）');
      }
    });

    // 2) 监听 cap 元素自身事件（不同实现的事件名可能不同，全部兜底）
    if(capEl && typeof capEl.addEventListener==='function'){
      ['success','verified','cap-success','capVerified','change'].forEach(evt=>{
        capEl.addEventListener(evt, ()=>{
          const status = (capEl.getAttribute('data-status')||'').toLowerCase();
          const token  = capEl.getAttribute('data-token') || capEl.getAttribute('data-cap-token') || '';
          if(status==='success' || token){ markCaptchaPassed(token); log('验证码通过（元素事件:'+evt+'）'); }
        });
      });
    }

    // 3) 监听属性变化（部分实现会把状态/令牌写入 data-* 属性）
    if(capEl && typeof MutationObserver==='function'){
      const obs = new MutationObserver(()=>{
        const status = capEl.getAttribute('data-status') || '';
        const token  = capEl.getAttribute('data-token') || capEl.getAttribute('data-cap-token') || '';
        if(status.toLowerCase()==='success' || token){ markCaptchaPassed(token); log('验证码通过（MutationObserver）'); }
      });
      obs.observe(capEl, { attributes:true, attributeFilter:['data-status','data-token','data-cap-token'] });
    }

    // 4) 轮询 cap SDK（若提供 getToken 方法）
    let pollCount = 0;
    const poll = setInterval(()=>{
      try{
        const t = (window.cap && typeof window.cap.getToken==='function') ? window.cap.getToken() : '';
        if(t){ markCaptchaPassed(t); log('验证码通过（轮询 SDK）'); clearInterval(poll); }
      }catch(_){ /* 忽略 */ }
      if(++pollCount>20){ // 最多轮询 ~10s（500ms*20）
        clearInterval(poll);
      }
    }, 500);

    $('loginBtn').onclick = requireLogin;
    $('loadExam').onclick = loadExam;
    $('downloadExam').onclick = downloadExam;
    $('pushGitHub').onclick = pushGitHub;
    if($('decryptFillToken')) $('decryptFillToken').onclick = decryptAndFillToken;
    if($('togglePassVisibility')) $('togglePassVisibility').onclick = ()=>toggleVisibility('ghPass');
    if($('toggleTokenVisibility')) $('toggleTokenVisibility').onclick = ()=>toggleVisibility('ghToken');
    if($('importDemoToken')) $('importDemoToken').onclick = importDemoToken;
    if($('saveEncryptedToken')) $('saveEncryptedToken').onclick = saveEncryptedToken;
    if($('clearEncryptedToken')) $('clearEncryptedToken').onclick = clearEncryptedToken;
    if($('saveEncryptedToken')) $('saveEncryptedToken').onclick = saveEncryptedToken;
    if($('clearEncryptedToken')) $('clearEncryptedToken').onclick = clearEncryptedToken;
  });
})();
