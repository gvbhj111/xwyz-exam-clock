/*
 * 管理控制台 · 通用工具
 */
(function (global) {
  "use strict";

  var C = {
    LS_KEY: "examclock.admin.v1",
    LS_TOKEN: "gh_token_enc"
  };

  function $(id) { return document.getElementById(id); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  function merge(base, override) {
    var out = deepCopy(base || {});
    Object.keys(override || {}).forEach(function (k) {
      var v = override[k];
      if (v && typeof v === "object" && !Array.isArray(v)) out[k] = merge(out[k] || {}, v);
      else out[k] = v;
    });
    return out;
  }

  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function diffDays(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  function timeStr(ts) {
    if (!ts) return "-";
    var d = new Date(ts);
    if (isNaN(+d)) return "-";
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function toast(msg, kind) {
    var box = document.getElementById("toastBox");
    if (!box) {
      box = el("div", "toastBox");
      box.id = "toastBox";
      document.body.appendChild(box);
    }
    var t = el("div", "toast" + (kind ? " " + kind : ""), esc(msg));
    box.appendChild(t);
    setTimeout(function () { t.classList.add("show"); }, 10);
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { t.remove(); }, 300); }, 3200);
  }

  /* 弹窗表单 */
  function modal(opts) {
    var wrap = $("modal");
    $("modalTitle").innerHTML = opts.title || "编辑";
    var body = $("modalBody");
    body.innerHTML = opts.html || "";
    wrap.classList.add("open");
    if (opts.onMount) opts.onMount(body);
    return new Promise(function (resolve) {
      function close(val) {
        wrap.classList.remove("open");
        $("modalOk").onclick = null;
        $("modalCancel").onclick = null;
        $("modalClose").onclick = null;
        wrap.onclick = null;
        resolve(val);
      }
      $("modalOk").onclick = function () { close(opts.onOk ? opts.onOk(body) : true); };
      $("modalCancel").onclick = function () { close(null); };
      $("modalClose").onclick = function () { close(null); };
      wrap.onclick = function (e) { if (e.target === wrap) close(null); };
    });
  }

  /* 简易确认框 */
  function confirmBox(msg) {
    return modal({
      title: "确认操作",
      html: '<p>' + esc(msg) + "</p>",
      onOk: function () { return true; }
    });
  }

  /* 本地存储 */
  function lsGet(key, def) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? def : v; }
    catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ------------------------------------------------------------ 加密 */
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function unb64(str) { return decodeURIComponent(escape(atob(str))); }

  function deriveKey(pass, saltBytes) {
    var enc = new TextEncoder();
    return crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"])
      .then(function (km) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
          km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
      });
  }

  function encryptToken(token, pass) {
    var enc = new TextEncoder();
    var iv = crypto.getRandomValues(new Uint8Array(12));
    var salt = crypto.getRandomValues(new Uint8Array(16));
    return deriveKey(pass, salt).then(function (key) {
      return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, enc.encode(token));
    }).then(function (cipher) {
      var out = { iv: Array.from(iv), salt: Array.from(salt), cipher: Array.from(new Uint8Array(cipher)) };
      lsSet(C.LS_TOKEN, out);
      return out;
    });
  }

  function decryptToken(data, pass) {
    var dec = new TextDecoder();
    var iv = new Uint8Array(data.iv || []);
    var salt = new Uint8Array(data.salt || []);
    var cipher = new Uint8Array(data.cipher || []);
    return deriveKey(pass, salt).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, cipher);
    }).then(function (buf) { return dec.decode(buf); });
  }

  /* 读取本地文件 */
  function readFile(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = reject;
      r.readAsText(file, "utf-8");
    });
  }

  /* 读取本地文件为 dataURL（用于把音频内联进配置） */
  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result || "")); };
      r.onerror = function () { reject(new Error("读取失败")); };
      r.readAsDataURL(file);
    });
  }

  global.AdminUtil = {
    C: C, $: $, $$: $$, el: el, esc: esc, deepCopy: deepCopy, merge: merge,
    download: download, diffDays: diffDays, timeStr: timeStr, pad: pad, toast: toast,
    modal: modal, confirm: confirmBox,
    lsGet: lsGet, lsSet: lsSet,
    b64: b64, unb64: unb64, encryptToken: encryptToken, decryptToken: decryptToken,
    readFile: readFile, readFileAsDataURL: readFileAsDataURL
  };
})(window);
