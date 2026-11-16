/**
 * CONTENT SCRIPT (v5.1.0) CHẠY TRÊN TAB MUSE AI (muse.ai) & GOOGLE FLOW (labs.google / flow.google.com)
 * XỬ LÝ TRIỆT ĐỂ LỖI CHỜ LÂU:
 * 1. Bỏ toàn bộ cơ chế chặn đệm 3.5s sau khi Submit (không bao giờ vô tình nuốt mất ảnh mới sinh ra).
 * 2. Ưu tiên trích xuất Base64 tức thì (2ms) bằng thẻ <img> trực tiếp trên DOM qua Canvas (không nghẽn network).
 * 3. Bắt đúng ảnh/video mới sinh ra ngay khi xuất hiện trên trang mà không bị chờ timeout.
 */

var DEFAULT_SELECTORS = {
  fileInput: 'input[type="file"]',
  dropZone: '[data-testid*="drop"], [aria-label*="Upload"], [aria-label*="Tải lên"], form, main',
  promptInput: 'textarea, [contenteditable="true"][role="textbox"], div[contenteditable="true"]',
  resultMedia: 'video, img'
};

window.__AI_CANVAS_BRIDGE_LOGS__ = window.__AI_CANVAS_BRIDGE_LOGS__ || [];
window.__AI_CANVAS_LOG_LAST_KEY__ = window.__AI_CANVAS_LOG_LAST_KEY__ || '';
window.__AI_CANVAS_LOG_OPEN__ = window.__AI_CANVAS_LOG_OPEN__ || false;

function renderBridgeLogPanel() {
  const panel = document.getElementById('ai-canvas-flow-log-panel');
  const list = document.getElementById('ai-canvas-flow-log-list');
  const countEl = document.getElementById('ai-canvas-flow-log-count');
  const logs = window.__AI_CANVAS_BRIDGE_LOGS__ || [];
  if (countEl) {
    countEl.textContent = String(logs.length);
  }
  if (!panel || !list) return;
  const isFullHideMuse = Boolean(window.__AI_CANVAS_EMBED_OPEN__ && (window.__AI_CANVAS_EMBED_WIDTH__ || 54) >= 98);
  panel.style.display = window.__AI_CANVAS_LOG_OPEN__ && !isFullHideMuse ? 'flex' : 'none';
  if (!window.__AI_CANVAS_LOG_OPEN__ || isFullHideMuse) return;

  list.innerHTML = logs.length === 0
    ? '<div style="opacity:0.6;padding:12px;text-align:center;">Chưa có nhật ký hoạt động.</div>'
    : logs
        .slice()
        .reverse()
        .map((item) => {
          const dotColor =
            item.level === 'error' ? '#ef4444' : item.level === 'success' ? '#10b981' : item.level === 'warn' ? '#f59e0b' : '#38bdf8';
          return `<div style="display:flex;align-items:flex-start;gap:7px;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.07);font-size:11px;line-height:1.4;">
            <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};margin-top:4px;flex-shrink:0;"></span>
            <span style="color:#94a3b8;font-family:monospace;flex-shrink:0;">${item.time}</span>
            <span style="color:#e2e8f0;word-break:break-word;">${item.text.replace(/</g, '&lt;')}</span>
          </div>`;
        })
        .join('');
}

function appendBridgeLog(text, bg = '') {
  if (!text) return;
  // Gom các bước đếm giây liên tiếp (1s), (2s)... để log gọn, chỉ ghi mỗi 5s hoặc khi đổi nội dung chính
  const baseKey = text.replace(/\(\d+s[^)]*\)/g, '(Xs)').replace(/\(\d+\/\d+\)/g, '(X)');
  const now = Date.now();
  if (baseKey === window.__AI_CANVAS_LOG_LAST_KEY__ && now - (window.__AI_CANVAS_LOG_LAST_AT__ || 0) < 5000) {
    return;
  }
  window.__AI_CANVAS_LOG_LAST_KEY__ = baseKey;
  window.__AI_CANVAS_LOG_LAST_AT__ = now;

  const isMuse = window.location.hostname.includes('muse.ai');
  const level =
    bg.includes('#dc2626') || text.includes('❌') || text.includes('⚠️')
      ? 'error'
      : bg.includes('#10b981') || text.includes('✅')
      ? 'success'
      : bg.includes('#f59e0b') || text.includes('⏳')
      ? 'warn'
      : 'info';

  const entry = {
    id: `muse-${now}-${Math.random().toString(36).slice(2, 6)}`,
    time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
    source: isMuse ? 'Muse AI' : 'Google Flow',
    text,
    level
  };
  window.__AI_CANVAS_BRIDGE_LOGS__.push(entry);
  if (window.__AI_CANVAS_BRIDGE_LOGS__.length > 80) {
    window.__AI_CANVAS_BRIDGE_LOGS__.shift();
  }
  renderBridgeLogPanel();

  // Đồng bộ tức thì 0ms vào iframe Tool nếu đang mở chung trên trang Muse
  try {
    const toolIframe = document.getElementById('ai-canvas-muse-tool-iframe');
    if (toolIframe && toolIframe.contentWindow) {
      toolIframe.contentWindow.postMessage(
        { source: 'AI_CANVAS_EXTENSION', type: 'BRIDGE_LOG_EVENT', log: entry },
        '*'
      );
    }
  } catch (e) {}

  try {
    if (chrome && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.sendMessage({ type: 'BRIDGE_LOG_EVENT', log: entry }).catch?.(() => {});
    }
  } catch (e) {}
}

if (!window.__AI_CANVAS_PARENT_LOG_LISTENER__) {
  window.__AI_CANVAS_PARENT_LOG_LISTENER__ = true;
  window.addEventListener('message', (event) => {
    if (event.data?.source === 'AI_CANVAS_WEB' && event.data?.type === 'CANVAS_LOG_EVENT' && event.data?.log) {
      const l = event.data.log;
      if (!window.__AI_CANVAS_BRIDGE_LOGS__.some((x) => x.id && x.id === l.id)) {
        window.__AI_CANVAS_BRIDGE_LOGS__.push(l);
        if (window.__AI_CANVAS_BRIDGE_LOGS__.length > 80) {
          window.__AI_CANVAS_BRIDGE_LOGS__.shift();
        }
        renderBridgeLogPanel();
      }
    }
  });
}

window.__AI_CANVAS_EMBED_OPEN__ = window.__AI_CANVAS_EMBED_OPEN__ || false;
window.__AI_CANVAS_EMBED_WIDTH__ = window.__AI_CANVAS_EMBED_WIDTH__ || 54;
window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ = window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ || 54;

function applyMuseEmbeddedLayout() {
  const dock = document.getElementById('ai-canvas-muse-tool-dock');
  const badge = document.getElementById('ai-canvas-flow-badge');
  const panel = document.getElementById('ai-canvas-flow-log-panel');
  const toggleBtn = document.getElementById('ai-canvas-flow-embed-btn');
  const hideMuseBtn = document.getElementById('ai-canvas-embed-hide-muse');
  const resizer = document.getElementById('ai-canvas-embed-resizer');
  const w = Math.max(25, Math.min(100, Number(window.__AI_CANVAS_EMBED_WIDTH__) || 54));
  const isFullHideMuse = w >= 98;

  if (window.__AI_CANVAS_EMBED_OPEN__) {
    if (dock) {
      dock.style.display = 'flex';
      dock.style.width = `${w}vw`;
    }
    if (isFullHideMuse) {
      // Toàn màn hình Tool (Ẩn Muse phía sau): ẩn luôn badge phụ của Muse để chỉ hiển thị 1 thanh Log duy nhất của Tool!
      document.documentElement.style.marginLeft = '';
      document.documentElement.style.width = '';
      document.documentElement.style.overflowX = '';
      if (badge) badge.style.display = 'none';
      if (panel) panel.style.display = 'none';
      if (hideMuseBtn) hideMuseBtn.textContent = '👁️ Hiện Muse';
      if (resizer) resizer.style.right = '0px';
    } else {
      document.documentElement.style.marginLeft = `${w}vw`;
      document.documentElement.style.width = `${100 - w}vw`;
      document.documentElement.style.overflowX = 'hidden';
      if (badge) {
        badge.style.display = 'flex';
        badge.style.left = `calc(${w}vw + 14px)`;
      }
      if (panel) {
        panel.style.left = `calc(${w}vw + 14px)`;
        panel.style.display = window.__AI_CANVAS_LOG_OPEN__ ? 'flex' : 'none';
      }
      if (hideMuseBtn) hideMuseBtn.textContent = '👁️ Ẩn Muse (Chạy ngầm)';
      if (resizer) resizer.style.right = '-5px';
    }
    if (toggleBtn) toggleBtn.textContent = '✕ Đóng Tool';
  } else {
    if (dock) dock.style.display = 'none';
    document.documentElement.style.marginLeft = '';
    document.documentElement.style.width = '';
    document.documentElement.style.overflowX = '';
    if (badge) {
      badge.style.display = 'flex';
      badge.style.left = '18px';
    }
    if (panel) {
      panel.style.left = '18px';
      panel.style.display = window.__AI_CANVAS_LOG_OPEN__ ? 'flex' : 'none';
    }
    if (toggleBtn) toggleBtn.textContent = '🧩 Mở Tool';
  }
}

async function sendNativeCdpWithDockPassThrough(message) {
  const dock = document.getElementById('ai-canvas-muse-tool-dock');
  const needPassThrough = Boolean(
    dock &&
      window.__AI_CANVAS_EMBED_OPEN__ &&
      (window.__AI_CANVAS_EMBED_WIDTH__ >= 95 ||
        (typeof message.x === 'number' && message.x <= (window.innerWidth * window.__AI_CANVAS_EMBED_WIDTH__) / 100))
  );
  // Chỉ tắt pointer-events (giữ nguyên visibility: visible) để chuột phần cứng đi xuyên qua xuống Muse AI
  // mà KHÔNG làm chớp tắt hay lộ trang Muse AI khi người dùng đang ẩn Muse!
  if (needPassThrough && dock) {
    dock.style.pointerEvents = 'none';
    await new Promise((r) => setTimeout(r, 25));
  }
  try {
    return await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(message, (res) => resolve(res));
      } catch (e) {
        resolve({ ok: false });
      }
    });
  } finally {
    if (needPassThrough && dock) {
      dock.style.pointerEvents = 'auto';
    }
  }
}

function toggleMuseEmbeddedTool(forceOpen = null) {
  window.__AI_CANVAS_EMBED_OPEN__ = forceOpen !== null ? Boolean(forceOpen) : !window.__AI_CANVAS_EMBED_OPEN__;

  let dock = document.getElementById('ai-canvas-muse-tool-dock');
  if (window.__AI_CANVAS_EMBED_OPEN__ && !dock) {
    dock = document.createElement('div');
    dock.id = 'ai-canvas-muse-tool-dock';
    dock.style.cssText =
      'position:fixed;top:0;left:0;height:100vh;width:54vw;z-index:2147483646;background:#0f172a;border-right:2px solid rgba(56,189,248,0.55);box-shadow:8px 0 32px rgba(0,0,0,0.45);display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;';
    dock.innerHTML = `
      <div style="height:40px;background:linear-gradient(90deg,#0f172a,#1e293b);color:#f8fafc;display:flex;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid rgba(255,255,255,0.12);font-size:12px;font-weight:700;flex-shrink:0;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span style="width:8px;height:8px;border-radius:50%;background:#10b981;box-shadow:0 0 8px #10b981;flex-shrink:0;"></span>
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🎨 AI Canvas Studio • Dùng chung trang Muse AI</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
          <button id="ai-canvas-embed-w50" style="background:rgba(255,255,255,0.12);border:none;color:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">50/50</button>
          <button id="ai-canvas-embed-w68" style="background:rgba(255,255,255,0.12);border:none;color:#e2e8f0;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">68/32</button>
          <button id="ai-canvas-embed-hide-muse" style="background:rgba(16,185,129,0.28);border:1px solid rgba(16,185,129,0.5);color:#a7f3d0;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;">👁️ Ẩn Muse (Chạy ngầm)</button>
          <button id="ai-canvas-embed-split" style="background:rgba(14,165,233,0.28);border:1px solid rgba(56,189,248,0.45);color:#bae6fd;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;" title="Tách thành 2 cửa sổ song song">🪟 Tách 2 cửa sổ</button>
          <button id="ai-canvas-embed-close" style="background:rgba(239,68,68,0.25);border:none;color:#fecaca;padding:4px 8px;border-radius:6px;font-size:11px;cursor:pointer;">✕ Đóng</button>
        </div>
      </div>
      <iframe id="ai-canvas-muse-tool-iframe" src="http://localhost:5174/" style="width:100%;height:calc(100% - 40px);border:none;background:#f8fafc;" allow="clipboard-read; clipboard-write"></iframe>
      <div id="ai-canvas-embed-resizer" title="Kéo sang trái / phải để tùy chỉnh kích thước" style="position:absolute;top:0;right:-5px;width:10px;height:100%;cursor:col-resize;z-index:2147483647;display:flex;align-items:center;justify-content:center;">
        <div style="width:4px;height:48px;border-radius:999px;background:rgba(56,189,248,0.85);box-shadow:0 0 10px rgba(56,189,248,0.7);"></div>
      </div>
    `;
    (document.body || document.documentElement).appendChild(dock);

    dock.querySelector('#ai-canvas-embed-w50')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__AI_CANVAS_EMBED_WIDTH__ = 50;
      window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ = 50;
      applyMuseEmbeddedLayout();
    });
    dock.querySelector('#ai-canvas-embed-w68')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__AI_CANVAS_EMBED_WIDTH__ = 68;
      window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ = 68;
      applyMuseEmbeddedLayout();
    });
    dock.querySelector('#ai-canvas-embed-hide-muse')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (window.__AI_CANVAS_EMBED_WIDTH__ >= 98) {
        window.__AI_CANVAS_EMBED_WIDTH__ = window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ || 54;
      } else {
        window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ = window.__AI_CANVAS_EMBED_WIDTH__;
        window.__AI_CANVAS_EMBED_WIDTH__ = 100;
      }
      applyMuseEmbeddedLayout();
    });
    dock.querySelector('#ai-canvas-embed-split')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMuseEmbeddedTool(false);
      try {
        chrome.runtime.sendMessage({ type: 'OPEN_SPLIT_WINDOWS', canvasUrl: 'http://localhost:5174/' });
      } catch (err) {}
    });
    dock.querySelector('#ai-canvas-embed-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMuseEmbeddedTool(false);
    });

    // Kéo thả co giãn kích thước tự do (25vw - 100vw)
    const resizer = dock.querySelector('#ai-canvas-embed-resizer');
    const iframeEl = dock.querySelector('#ai-canvas-muse-tool-iframe');
    resizer?.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (iframeEl) iframeEl.style.pointerEvents = 'none';
      document.body.style.userSelect = 'none';

      const onMove = (moveEv) => {
        const pct = Math.max(25, Math.min(100, (moveEv.clientX / window.innerWidth) * 100));
        window.__AI_CANVAS_EMBED_WIDTH__ = Math.round(pct * 10) / 10;
        if (pct < 95) window.__AI_CANVAS_EMBED_LAST_SPLIT_WIDTH__ = window.__AI_CANVAS_EMBED_WIDTH__;
        applyMuseEmbeddedLayout();
      };
      const onUp = () => {
        if (iframeEl) iframeEl.style.pointerEvents = 'auto';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }

  applyMuseEmbeddedLayout();
}

function mountConnectionBadge() {
  const isMuse = window.location.hostname.includes('muse.ai');
  let badge = document.getElementById('ai-canvas-flow-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'ai-canvas-flow-badge';
    badge.title = 'Nhấn để mở / thu gọn Nhật ký hoạt động';
    badge.style.cssText =
      'position:fixed;bottom:18px;left:18px;z-index:2147483647;background:rgba(15,23,42,0.92);backdrop-filter:blur(10px);color:#fff;border:1px solid rgba(16,185,129,0.5);padding:6px 12px;border-radius:999px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,0.45);display:flex;align-items:center;gap:8px;pointer-events:auto;cursor:pointer;user-select:none;transition:all 0.25s ease;';
    badge.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;display:inline-block;flex-shrink:0;"></span><span id="ai-canvas-flow-badge-text">AI Canvas Bridge v6.0: Đã kết nối (${isMuse ? 'Muse AI' : 'Flow'})</span><span id="ai-canvas-flow-log-count" style="background:rgba(255,255,255,0.18);padding:1px 6px;border-radius:999px;font-size:10px;">0</span><button id="ai-canvas-flow-embed-btn" style="background:rgba(14,165,233,0.35);border:1px solid rgba(56,189,248,0.5);color:#e0f2fe;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;cursor:pointer;">🧩 Mở Tool</button><span id="ai-canvas-flow-badge-arrow" style="font-size:10px;opacity:0.85;">▲</span>`;
    badge.querySelector('#ai-canvas-flow-embed-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMuseEmbeddedTool();
    });
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__AI_CANVAS_LOG_OPEN__ = !window.__AI_CANVAS_LOG_OPEN__;
      const arrow = document.getElementById('ai-canvas-flow-badge-arrow');
      if (arrow) arrow.textContent = window.__AI_CANVAS_LOG_OPEN__ ? '▼' : '▲';
      renderBridgeLogPanel();
    });
    (document.body || document.documentElement).appendChild(badge);
  }

  if (!document.getElementById('ai-canvas-flow-log-panel')) {
    const panel = document.createElement('div');
    panel.id = 'ai-canvas-flow-log-panel';
    panel.style.cssText =
      'position:fixed;bottom:62px;left:18px;z-index:2147483647;width:360px;max-width:calc(100vw - 36px);max-height:280px;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);color:#f8fafc;border:1px solid rgba(56,189,248,0.35);border-radius:16px;box-shadow:0 12px 32px rgba(0,0,0,0.55);display:none;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,sans-serif;';
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:rgba(30,41,59,0.9);border-bottom:1px solid rgba(255,255,255,0.1);font-size:12px;font-weight:700;">
        <span>📋 Nhật ký ${isMuse ? 'Muse AI' : 'Flow'} Bridge</span>
        <div style="display:flex;gap:6px;">
          <button id="ai-canvas-flow-log-clear" style="background:rgba(255,255,255,0.12);border:none;color:#cbd5e1;padding:2px 8px;border-radius:6px;font-size:11px;cursor:pointer;">Xóa</button>
          <button id="ai-canvas-flow-log-close" style="background:rgba(255,255,255,0.12);border:none;color:#cbd5e1;padding:2px 8px;border-radius:6px;font-size:11px;cursor:pointer;">Thu gọn ▾</button>
        </div>
      </div>
      <div id="ai-canvas-flow-log-list" style="overflow-y:auto;max-height:225px;padding:4px;"></div>
    `;
    (document.body || document.documentElement).appendChild(panel);
    panel.querySelector('#ai-canvas-flow-log-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__AI_CANVAS_BRIDGE_LOGS__ = [];
      renderBridgeLogPanel();
    });
    panel.querySelector('#ai-canvas-flow-log-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__AI_CANVAS_LOG_OPEN__ = false;
      const arrow = document.getElementById('ai-canvas-flow-badge-arrow');
      if (arrow) arrow.textContent = '▲';
      renderBridgeLogPanel();
    });
  }
}

function updateBridgeBadgeText(text, bg = 'rgba(15,23,42,0.92)') {
  mountConnectionBadge();
  const badge = document.getElementById('ai-canvas-flow-badge');
  const txt = document.getElementById('ai-canvas-flow-badge-text');
  if (badge && badge.dataset.lastBg !== bg) {
    badge.style.background = bg;
    badge.dataset.lastBg = bg;
  }
  if (txt && txt.textContent !== text) {
    txt.textContent = text;
  }
  appendBridgeLog(text, bg);
}

function showClickMarker(x, y) {
  let marker = document.getElementById('ai-canvas-click-marker');
  if (!marker) {
    marker = document.createElement('div');
    marker.id = 'ai-canvas-click-marker';
    document.body.appendChild(marker);
  }
  marker.style.cssText = `position:fixed;left:${x - 18}px;top:${y - 18}px;width:36px;height:36px;border-radius:50%;border:4px solid #10b981;background:rgba(16,185,129,0.28);z-index:9999999;pointer-events:none;box-shadow:0 0 18px #10b981;opacity:1;transition:all 0.2s ease;`;
  setTimeout(() => {
    if (marker) marker.style.opacity = '0';
  }, 1500);
}

function flashPingBadge() {
  updateBridgeBadgeText('⚡ Nhận tín hiệu Ping thành công từ Web Canvas (v5.1)!', '#4f46e5');
  setTimeout(() => {
    updateBridgeBadgeText('AI Canvas Bridge v5.1: Đã kết nối', 'rgba(16,185,129,0.95)');
  }, 3000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountConnectionBadge);
} else {
  mountConnectionBadge();
}

function queryAllDeep(root = document) {
  const results = [];
  const walker = (node) => {
    if (!node) return;
    const children = node.children || [];
    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      results.push(el);
      if (el.shadowRoot) walker(el.shadowRoot);
      walker(el);
    }
  };
  walker(root);
  return results;
}

// Chuyển ảnh sang Base64 nhanh nhất có thể: Ưu tiên vẽ trực tiếp từ thẻ DOM (2ms)
async function convertFlowUrlToBase64(mediaUrl, domElement = null) {
  if (domElement && domElement.tagName === 'IMG' && domElement.complete && domElement.naturalWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = domElement.naturalWidth;
      canvas.height = domElement.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(domElement, 0, 0);
      const b64 = canvas.toDataURL('image/jpeg', 0.92);
      if (b64 && b64.startsWith('data:image/')) {
        return b64;
      }
    } catch (e) {}
  }

  if (mediaUrl && !mediaUrl.startsWith('blob:')) {
    const bgRes = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 3000);
      try {
        chrome.runtime.sendMessage({ type: 'FETCH_URL_AS_BASE64', url: mediaUrl }, (res) => {
          clearTimeout(timer);
          resolve(res);
        });
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
    if (bgRes && bgRes.ok && bgRes.base64) {
      return bgRes.base64;
    }
  }

  try {
    const response = await fetch(mediaUrl);
    if (response.ok) {
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {}

  return mediaUrl;
}

function dataUrlToFilePureJS(dataUrl, filename = 'node_input.jpg') {
  const commaIdx = dataUrl.indexOf(',');
  const header = commaIdx >= 0 ? dataUrl.slice(0, commaIdx) : '';
  const base64Body = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const mimeMatch = header.match(/data:([^;]+)/i);
  const mime = (mimeMatch && mimeMatch[1]) || 'image/jpeg';

  const cleanBase64 = base64Body.replace(/[\r\n\s]+/g, '');
  const binaryStr = atob(cleanBase64);
  const len = binaryStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }

  const ext = mime.includes('png') ? '.png' : '.jpg';
  const safeName = filename.replace(/\.(png|jpe?g|webp)$/i, '') + ext;
  return new File([bytes], safeName, { type: mime });
}

async function resolveInputToDataUrl(inputSource) {
  if (!inputSource) return '';
  if (inputSource.startsWith('data:')) {
    return inputSource;
  }
  const bgRes = await new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: 'FETCH_URL_AS_BASE64', url: inputSource }, (res) => resolve(res));
    } catch (e) {
      resolve(null);
    }
  });
  if (bgRes && bgRes.ok && bgRes.base64 && bgRes.base64.startsWith('data:')) {
    return bgRes.base64;
  }
  return inputSource;
}

async function base64ToFile(inputSource, filename = 'node_input.jpg') {
  const finalDataUrl = await resolveInputToDataUrl(inputSource);
  if (finalDataUrl && finalDataUrl.startsWith('data:')) {
    return dataUrlToFilePureJS(finalDataUrl, filename);
  }
  const res = await fetch(finalDataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

function findFlowPromptElement() {
  const isMuseAi = window.location.hostname.includes('muse.ai');
  const allEls = queryAllDeep(document);

  // 1. Nếu đang ở trên trang Muse AI
  if (isMuseAi) {
    const musePromptCandidates = allEls.filter((el) => {
      const isEditable =
        el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && (el.type === 'text' || !el.type)) ||
        el.getAttribute?.('contenteditable') === 'true' ||
        el.getAttribute?.('role') === 'textbox';
      if (!isEditable) return false;
      const placeholder = (el.getAttribute?.('placeholder') || '').toLowerCase();
      // Bỏ qua input đăng nhập email/password nếu có
      if (placeholder.includes('email') || placeholder.includes('phone') || placeholder.includes('password')) {
        return false;
      }
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.height > 20;
    });

    if (musePromptCandidates.length > 0) {
      musePromptCandidates.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
      return musePromptCandidates[0];
    }
  }

  // 2. Mặc định quét cho cả Muse AI và Google Flow
  const candidates = allEls.filter((el) => {
    const isEditable =
      el.tagName === 'TEXTAREA' ||
      el.getAttribute?.('contenteditable') === 'true' ||
      el.getAttribute?.('role') === 'textbox';
    if (!isEditable) return false;
    const r = el.getBoundingClientRect();
    return r.width > 70 && r.height > 12 && r.top > window.innerHeight * 0.15;
  });

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);
    return candidates[0];
  }

  return document.querySelector(DEFAULT_SELECTORS.promptInput);
}

function getPromptBoxContainer(promptEl) {
  if (!promptEl) return null;
  const promptRect = promptEl.getBoundingClientRect();
  let promptBox = promptEl.parentElement;
  let curr = promptEl.parentElement;
  for (let d = 0; d < 12 && curr && curr !== document.body; d++) {
    const r = curr.getBoundingClientRect();
    if (r.width > Math.max(promptRect.width + 160, window.innerWidth * 0.78) || r.height > 380) {
      break;
    }
    if (r.height >= promptRect.height + 24 && r.width >= promptRect.width) {
      promptBox = curr;
    }
    curr = curr.parentElement;
  }
  return promptBox;
}

function isSettingsOrOptionsButton(el) {
  if (!el) return false;
  const label = (
    (el.getAttribute?.('aria-label') || '') +
    ' ' +
    (el.getAttribute?.('title') || '') +
    ' ' +
    (el.getAttribute?.('data-testid') || '') +
    ' ' +
    (el.innerText || el.textContent || '')
  ).toLowerCase();

  return /tune|setting|slider|tùy chọn|cài đặt|parameter|ratio|tỷ lệ|16:9|9:16|1:1|4:3|3:4|seed|expand|fullscreen|phóng to|thu nhỏ|more_vert|more_horiz|close|dismiss/i.test(label);
}

function isTrueSubmitButton(el) {
  if (!el) return false;
  if (isSettingsOrOptionsButton(el)) return false;

  const label = (
    (el.getAttribute?.('aria-label') || '') +
    ' ' +
    (el.getAttribute?.('title') || '') +
    ' ' +
    (el.getAttribute?.('data-testid') || '') +
    ' ' +
    (el.innerText || el.textContent || '')
  ).toLowerCase();

  if (/arrow_forward|arrow_upward|send|gửi|tạo|generate|submit|play_arrow/i.test(label)) {
    return true;
  }

  const hasArrowIcon = !!el.querySelector?.('svg path, [data-icon*="arrow"], [data-icon*="send"], mat-icon');
  if (hasArrowIcon) {
    const iconTxt = (el.querySelector?.('mat-icon')?.innerText || '').toLowerCase();
    if (/arrow_forward|arrow_upward|send|gửi/i.test(iconTxt)) return true;
  }

  return false;
}

function findMuseSubmitTarget(promptEl) {
  if (!promptEl) return null;
  const pr = promptEl.getBoundingClientRect();
  const promptBox = promptEl.closest('form, [class*="composer"], [class*="input"], [class*="chat-input"]') || promptEl.parentElement?.parentElement || promptEl.parentElement;
  const boxRect = promptBox ? promptBox.getBoundingClientRect() : pr;

  const allElements = queryAllDeep(document);

  // Helper kiểm tra nút có màu nền xanh dương đặc trưng trên Muse AI
  const checkIsBlue = (el) => {
    try {
      const style = window.getComputedStyle(el);
      const bg = style.backgroundColor || '';
      const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (m) {
        const red = Number(m[1]);
        const blue = Number(m[3]);
        const alpha = m[4] !== undefined ? Number(m[4]) : 1;
        if (alpha > 0.35 && blue > 140 && blue > red * 1.2) return true;
      }
    } catch (e) {}
    return false;
  };

  // TUYỆT ĐỐI KHÔNG chọn phần tử nằm trong Sidebar trái hoặc thẻ aside/nav/header
  const validElements = allElements.filter((el) => {
    if (el.closest?.('aside, nav, header')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 14 || r.width > 90 || r.height < 14 || r.height > 90) return false;

    // Loại trừ Sidebar trái (dưới 65px)
    if (r.left < 65) return false;

    // Phải nằm trong khu vực dock của promptEl (tự co giãn theo khung nhập dù Sidebar phải đóng hay mở)
    const inPromptZone =
      r.top >= pr.top - 50 &&
      r.bottom <= Math.max(pr.bottom + 140, boxRect.bottom + 80) &&
      r.left >= pr.left + pr.width * 0.20 &&
      r.right <= Math.max(pr.right + 120, boxRect.right + 60);

    if (!inPromptZone) return false;

    // Loại trừ nút microphone, emoji, settings, và nút close/remove chip
    const label = (
      (el.getAttribute?.('aria-label') || '') +
      ' ' +
      (el.getAttribute?.('title') || '') +
      ' ' +
      (el.getAttribute?.('data-testid') || '') +
      ' ' +
      (el.innerText || '')
    ).toLowerCase();

    if (/mic|voice|record|ghi âm|micro/i.test(label)) return false;
    if (/smile|emoji|icon|biểu tượng/i.test(label)) return false;
    if (/attach|đính kèm|upload|file|thêm/i.test(label)) return false;
    if (/setting|tune|tùy chọn|cài đặt|slider|parameter/i.test(label)) return false;
    if (/remove|xóa|delete|close|dismiss/i.test(label) || label.trim() === '✕' || label.trim() === '×') return false;
    if (/\b(stop|dừng|cancel)\b/i.test(label) || label.includes('⏹') || label.includes('■')) return false;

    const tag = (el.tagName || '').toLowerCase();
    const role = (el.getAttribute?.('role') || '').toLowerCase();
    const isClickable =
      tag === 'button' ||
      role === 'button' ||
      el.getAttribute?.('type') === 'submit' ||
      window.getComputedStyle(el).cursor === 'pointer' ||
      !!el.querySelector?.('svg') ||
      tag === 'svg';

    return isClickable;
  });

  if (validElements.length > 0) {
    // Sắp xếp: Ưu tiên số 1: Nút tròn màu xanh dương của Muse AI
    // Ưu tiên số 2: Nút có mũi tên lên / submit / send
    // Ưu tiên số 3: Nút ở góc dưới cùng bên phải gần promptEl nhất
    validElements.sort((a, b) => {
      const btnA = a.closest?.('button, [role="button"]') || a;
      const btnB = b.closest?.('button, [role="button"]') || b;
      const blueA = checkIsBlue(a) || checkIsBlue(btnA);
      const blueB = checkIsBlue(b) || checkIsBlue(btnB);
      if (blueA !== blueB) return blueB ? 1 : -1;

      const ra = btnA.getBoundingClientRect();
      const rb = btnB.getBoundingClientRect();

      const isSubA = a.type === 'submit' || /send|gửi|submit|↑/i.test((a.getAttribute?.('aria-label') || '') + ' ' + (a.innerText || ''));
      const isSubB = b.type === 'submit' || /send|gửi|submit|↑/i.test((b.getAttribute?.('aria-label') || '') + ' ' + (b.innerText || ''));
      if (isSubA !== isSubB) return isSubB ? 1 : -1;

      // Gần nhất với góc dưới phải của promptEl
      const distA = Math.hypot(ra.right - pr.right, ra.bottom - pr.bottom);
      const distB = Math.hypot(rb.right - pr.right, rb.bottom - pr.bottom);
      return distA - distB;
    });

    const target = validElements[0];
    const btnEl = target.closest?.('button, [role="button"]') || target;
    const btr = btnEl.getBoundingClientRect();
    return { el: btnEl, x: btr.left + btr.width / 2, y: btr.top + btr.height / 2 };
  }

  // Fallback: Nếu không tìm thấy bằng tọa độ tương đối, tìm nút có svg mũi tên lên gần promptEl nhất
  const arrowButtons = allElements.filter((el) => {
    if (el.closest?.('aside, nav, header')) return false;
    const r = el.getBoundingClientRect();
    if (r.left < 65 || r.right > Math.max(pr.right + 120, boxRect.right + 60)) return false;
    if (r.top < pr.top - 50 || r.bottom > Math.max(pr.bottom + 140, boxRect.bottom + 80)) return false;
    return !!el.querySelector?.('svg') || (el.tagName || '').toLowerCase() === 'button';
  });

  if (arrowButtons.length > 0) {
    arrowButtons.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return Math.hypot(ra.right - pr.right, ra.bottom - pr.bottom) - Math.hypot(rb.right - pr.right, rb.bottom - pr.bottom);
    });
    const target = arrowButtons[0];
    const btnEl = target.closest?.('button, [role="button"]') || target;
    const btr = btnEl.getBoundingClientRect();
    return { el: btnEl, x: btr.left + btr.width / 2, y: btr.top + btr.height / 2 };
  }

  return null;
}

function findFlowSubmitTarget(promptEl) {
  if (!promptEl) return null;

  // Nếu đang ở trên trang Muse AI, ưu tiên thuật toán nhận diện nút Submit Muse AI
  const isMuseAi = window.location.hostname.includes('muse.ai');
  if (isMuseAi) {
    const museTarget = findMuseSubmitTarget(promptEl);
    if (museTarget) return museTarget;
  }

  const pr = promptEl.getBoundingClientRect();
  const promptBox = getPromptBoxContainer(promptEl);
  const boxRect = promptBox ? promptBox.getBoundingClientRect() : pr;

  const allElements = queryAllDeep(document);

  // Mở rộng tọa độ toolbar góc dưới phải để không bị lệch khi textarea nhiều dòng
  const inBottomRightToolbar = (r) => {
    if (r.width < 13 || r.width > 85 || r.height < 13 || r.height > 85) return false;
    const isBelowOrAtBottomOfPrompt = r.top >= pr.top - 20 && r.bottom <= Math.max(pr.bottom + 120, boxRect.bottom + 60);
    const isOnRightHalf = r.left >= pr.left + pr.width * 0.40 && r.right <= Math.max(pr.right + 80, boxRect.right + 40);
    return isBelowOrAtBottomOfPrompt && isOnRightHalf;
  };

  // 1. Tìm chính xác nút có nhãn hoặc icon là Submit/Send/Gửi (loại trừ tuyệt đối nút Settings/Tune/Ratio)
  const explicitSubmitBtns = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (!inBottomRightToolbar(r)) return false;
    if (isSettingsOrOptionsButton(el)) return false;
    return isTrueSubmitButton(el);
  });

  if (explicitSubmitBtns.length > 0) {
    explicitSubmitBtns.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    const target = explicitSubmitBtns[0];
    const tr = target.getBoundingClientRect();
    const btnEl = target.closest?.('button, [role="button"]') || target;
    return { el: btnEl, x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
  }

  // 1.5. Nút màu xanh dương (Muse AI hoặc theme hiện đại)
  const blueButtons = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (!inBottomRightToolbar(r)) return false;
    if (isSettingsOrOptionsButton(el)) return false;
    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor || '';
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) {
      const red = Number(m[1]);
      const blue = Number(m[3]);
      const alpha = m[4] !== undefined ? Number(m[4]) : 1;
      if (alpha > 0.35 && blue > 140 && blue > red * 1.25) return true;
    }
    return false;
  });

  if (blueButtons.length > 0) {
    blueButtons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    const target = blueButtons[0];
    const tr = target.getBoundingClientRect();
    const btnEl = target.closest?.('button, [role="button"]') || target;
    return { el: btnEl, x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
  }

  // 2. Nút nền trắng/sáng có mũi tên gửi ở góc dưới bên phải (Google Flow)
  const whiteButtons = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (!inBottomRightToolbar(r)) return false;
    if (isSettingsOrOptionsButton(el)) return false;

    const style = window.getComputedStyle(el);
    const bg = style.backgroundColor || '';
    const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) {
      const red = Number(m[1]);
      const green = Number(m[2]);
      const blue = Number(m[3]);
      const alpha = m[4] !== undefined ? Number(m[4]) : 1;
      if (alpha > 0.35 && red > 165 && green > 165 && blue > 165) {
        return true;
      }
    }
    const txt = ((el.innerText || el.textContent || '') + ' ' + (el.getAttribute?.('aria-label') || '')).toLowerCase();
    if (/arrow_forward|arrow_upward|send|gửi|tạo|generate|submit/i.test(txt)) {
      return true;
    }
    return false;
  });

  if (whiteButtons.length > 0) {
    whiteButtons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    const target = whiteButtons[0];
    const tr = target.getBoundingClientRect();
    const btnEl = target.closest?.('button, [role="button"]') || target;
    return { el: btnEl, x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
  }

  // 3. Fallback nút clickable ở ngoài cùng bên phải, TUYỆT ĐỐI KHÔNG CHỌN nút cài đặt / tùy chọn / tỉ lệ
  const bottomRightClickables = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (!inBottomRightToolbar(r)) return false;
    if (isSettingsOrOptionsButton(el)) return false;
    const tag = (el.tagName || '').toLowerCase();
    return (
      tag === 'button' ||
      tag.includes('button') ||
      el.getAttribute?.('role') === 'button' ||
      window.getComputedStyle(el).cursor === 'pointer'
    );
  });

  if (bottomRightClickables.length > 0) {
    bottomRightClickables.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right);
    const target = bottomRightClickables[0];
    const tr = target.getBoundingClientRect();
    const btnEl = target.closest?.('button, [role="button"]') || target;
    return { el: btnEl, x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
  }

  // Cuối cùng thử bằng findMuseSubmitTarget (ngay cả khi URL không khớp domain)
  return findMuseSubmitTarget(promptEl);
}

function triggerDOMClickAt(targetInfo) {
  if (!targetInfo) return;
  const { el, x, y } = targetInfo;
  showClickMarker(x, y);

  const opts = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: 1
  };

  const hitEl = (x && y ? document.elementFromPoint(x, y) : null) || el;
  // Tìm chính xác phần tử button hoặc phần tử clickable duy nhất:
  const btn = (hitEl && hitEl.closest('button, [role="button"]')) || (el && el.closest('button, [role="button"]')) || hitEl || el;
  if (!btn || btn.disabled) return;

  try {
    btn.dispatchEvent(new PointerEvent('pointerdown', opts));
    btn.dispatchEvent(new MouseEvent('mousedown', opts));
    btn.dispatchEvent(new PointerEvent('pointerup', opts));
    btn.dispatchEvent(new MouseEvent('mouseup', opts));
    btn.dispatchEvent(new MouseEvent('click', opts));
    if (typeof btn.click === 'function') {
      btn.click();
    }
  } catch (e) {
    try {
      if (typeof btn.click === 'function') btn.click();
    } catch (err) {}
  }
}

async function clearPreviousPromptAttachments(promptEl) {
  // 1. Tắt chế độ "Đang trả lời Muse" (Replying to) nếu đang hiển thị trên thanh prompt
  try {
    const allDivs = queryAllDeep(document);
    for (const el of allDivs) {
      const text = (el.innerText || el.textContent || '').trim();
      if (/^(đang trả lời|replying to|đang trả lời muse)/i.test(text)) {
        const pBox = el.closest?.('div') || el.parentElement;
        const closeBtn = pBox ? queryAllDeep(pBox).find((b) => {
          const t = (b.tagName || '').toLowerCase();
          return (t === 'button' || b.getAttribute?.('role') === 'button') && (b.innerText === '✕' || b.innerText === '×' || !!b.querySelector?.('svg'));
        }) : null;
        if (closeBtn) {
          closeBtn.click();
          await new Promise((r) => setTimeout(r, 120));
        }
      }
    }
  } catch (e) {}

  // 2. Quét và bấm xóa toàn bộ nút xóa (✕) chip đính kèm CHỈ BÊN TRONG khung soạn thảo promptBox
  // (Tuyệt đối không quét lên 550px phía trên vào luồng chat để tránh bấm nhầm nút Chia sẻ / Copy / Thích!)
  for (let cycle = 0; cycle < 4; cycle++) {
    const freshPrompt = findFlowPromptElement() || promptEl;
    const promptBox = freshPrompt ? getPromptBoxContainer(freshPrompt) : null;
    if (!promptBox) break;

    const removeButtons = queryAllDeep(promptBox).filter((el) => {
      if (freshPrompt && (el === freshPrompt || freshPrompt.contains(el))) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.width > 42 || r.height < 8 || r.height > 42) return false;

      const tag = (el.tagName || '').toLowerCase();
      const isClickable =
        tag === 'button' ||
        el.getAttribute?.('role') === 'button';
      if (!isClickable) return false;

      const label = (
        (el.getAttribute?.('aria-label') || '') +
        ' ' +
        (el.getAttribute?.('title') || '') +
        ' ' +
        (el.innerText || el.textContent || '')
      ).toLowerCase();

      if (/expand|fullscreen|open_in_full|mở rộng|phóng to|maximize|share|chia sẻ|copy|sao chép|mic|voice|attach|upload|thêm|add|send|gửi|stop|dừng/i.test(label)) {
        return false;
      }

      const matchesText = /remove|xóa|delete|close|dismiss|clear|huỷ|hủy/i.test(label) || label.trim() === '✕' || label.trim() === '×';
      // Hoặc nằm trực tiếp bên trong 1 thẻ preview/chip có ảnh (nút ✕ góc ảnh đính kèm)
      const isInsideChipImg = Boolean(el.parentElement?.querySelector?.('img, video'));
      return matchesText || isInsideChipImg;
    });

    if (removeButtons.length === 0) break;

    for (const btn of removeButtons) {
      try {
        btn.click();
        await new Promise((r) => setTimeout(r, 80));
      } catch (e) {}
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  // 3. Xóa sạch cả các thẻ input[type="file"] cũ nếu còn lưu files
  queryAllDeep(document)
    .filter((el) => el.tagName === 'INPUT' && el.type === 'file')
    .forEach((finput) => {
      try {
        finput.value = '';
      } catch (e) {}
    });

  // 4. Xóa sạch văn bản trong ô nhập Prompt
  try {
    const freshPrompt = findFlowPromptElement() || promptEl;
    if (freshPrompt) {
      freshPrompt.focus();
      const existingText = (freshPrompt.innerText || freshPrompt.value || '').trim();
      if (existingText.length > 0) {
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      }
    }
  } catch (e) {}
  await new Promise((r) => setTimeout(r, 150));
}

async function pasteSingleFileIntoPrompt(file, useNativeFocus = false) {
  const promptEl = findFlowPromptElement();
  if (!promptEl || !file) return;

  const promptBox = getPromptBoxContainer(promptEl);

  if (useNativeFocus) {
    const pr = promptEl.getBoundingClientRect();
    try {
      await sendNativeCdpWithDockPassThrough({
        type: 'NATIVE_CLICK_AND_ENTER',
        x: pr.left + pr.width * 0.5,
        y: pr.top + pr.height * 0.5,
        clickOnly: true
      });
    } catch (e) {}
  }

  const freshPrompt = findFlowPromptElement() || promptEl;
  freshPrompt.focus();

  const dt = new DataTransfer();
  dt.items.add(file);

  // 1. Chỉ ưu tiên input[type="file"] nếu có trên giao diện (cách nạp chuẩn xác 100% không bị nhân đôi)
  const availableFileInputs = queryAllDeep(document).filter((el) => {
    if (el.tagName !== 'INPUT' || el.type !== 'file') return false;
    const r = el.getBoundingClientRect();
    return r.top > window.innerHeight * 0.3;
  });

  if (availableFileInputs.length > 0) {
    try {
      const targetInput = availableFileInputs[0];
      targetInput.files = dt.files;
      targetInput.dispatchEvent(new Event('change', { bubbles: true }));
      targetInput.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    } catch (e) {}
  }

  // 2. Nếu không có file input, dùng ClipboardEvent('paste') duy nhất 1 lần vào freshPrompt
  freshPrompt.dispatchEvent(
    new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      composed: true,
      clipboardData: dt
    })
  );
}

// Tính fingerprint 16x16 grayscale trực tiếp từ thẻ <img> có sẵn trên DOM (0ms, hoàn toàn đồng bộ, không bao giờ nghẽn tab)
function computeImageFingerprintFromElement(el) {
  if (!el || el.tagName !== 'IMG' || !el.complete || el.naturalWidth === 0) return null;
  try {
    const cvs = document.createElement('canvas');
    cvs.width = 16;
    cvs.height = 16;
    const ctx = cvs.getContext('2d');
    ctx.drawImage(el, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    const gray = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
    }
    return gray;
  } catch (e) {
    return null;
  }
}

// Tính fingerprint từ chuỗi Base64 ảnh đầu vào khi vừa nạp vào
function computeImageFingerprintFromBase64(b64) {
  if (!b64 || typeof b64 !== 'string') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const timer = setTimeout(() => resolve(null), 1200);
      img.onload = () => {
        clearTimeout(timer);
        try {
          const cvs = document.createElement('canvas');
          cvs.width = 16;
          cvs.height = 16;
          const ctx = cvs.getContext('2d');
          ctx.drawImage(img, 0, 0, 16, 16);
          const data = ctx.getImageData(0, 0, 16, 16).data;
          const gray = [];
          for (let i = 0; i < data.length; i += 4) {
            gray.push(Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]));
          }
          resolve(gray);
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => {
        clearTimeout(timer);
        resolve(null);
      };
      img.src = b64;
    } catch (e) {
      resolve(null);
    }
  });
}

function isFingerprintMatch(fp1, fp2, threshold = 3.0) {
  if (!fp1 || !fp2 || fp1.length !== fp2.length) return false;
  let diffSum = 0;
  for (let i = 0; i < fp1.length; i++) {
    diffSum += Math.abs(fp1[i] - fp2[i]);
  }
  const avgDiff = diffSum / fp1.length;
  return avgDiff < threshold;
}

// Đếm số lượng ảnh đính kèm (chips) đang hiển thị trong khu vực prompt của Google Flow
function countAttachedChips(promptEl) {
  if (!promptEl) return 0;
  const promptBox = getPromptBoxContainer(promptEl);
  const container = promptBox || document;
  const pr = promptEl.getBoundingClientRect();

  // 1. Tìm các nút remove/xóa của chip đính kèm
  const removeButtons = queryAllDeep(container).filter((el) => {
    const r = el.getBoundingClientRect();
    const inChipZone =
      r.left >= pr.left - 60 &&
      r.right <= pr.right + 60 &&
      r.top >= pr.top - 180 &&
      r.bottom <= pr.bottom + 60;
    if (!inChipZone) return false;

    const label = (
      (el.getAttribute?.('aria-label') || '') +
      ' ' +
      (el.getAttribute?.('title') || '') +
      ' ' +
      (el.getAttribute?.('data-testid') || '')
    ).toLowerCase();

    return /remove|xóa|delete|close|dismiss/i.test(label);
  });

  if (removeButtons.length > 0) {
    return removeButtons.length;
  }

  // 2. Tìm các thẻ <img> hoặc thumbnail nằm trong vùng chip đính kèm
  const chipImgs = queryAllDeep(container).filter((el) => {
    if (el.tagName !== 'IMG') return false;
    const r = el.getBoundingClientRect();
    const inChipZone =
      r.left >= pr.left - 60 &&
      r.right <= pr.right + 60 &&
      r.top >= pr.top - 180 &&
      r.bottom <= pr.bottom + 60;
    if (!inChipZone) return false;
    if (r.width < 16 || r.height < 16 || r.width > 220 || r.height > 220) return false;
    return true;
  });

  return chipImgs.length;
}

// Kiểm tra xem có bất kỳ ảnh nào đang trong trạng thái loading/uploading hay không
function isAnyAttachmentUploading(promptEl) {
  if (!promptEl) return false;
  const promptBox = getPromptBoxContainer(promptEl);
  const container = promptBox || document;
  const pr = promptEl.getBoundingClientRect();

  const allInZone = queryAllDeep(container).filter((el) => {
    const r = el.getBoundingClientRect();
    return (
      r.left >= pr.left - 60 &&
      r.right <= pr.right + 60 &&
      r.top >= pr.top - 180 &&
      r.bottom <= pr.bottom + 90
    );
  });

  for (const el of allInZone) {
    const role = el.getAttribute?.('role') || '';
    const ariaBusy = el.getAttribute?.('aria-busy') || '';
    const tag = (el.tagName || '').toLowerCase();
    const cls = (el.className || '').toString().toLowerCase();

    if (role === 'progressbar' || ariaBusy === 'true') return true;
    if (tag === 'mat-progress-spinner' || tag === 'mdc-circular-progress') return true;
    if (
      cls.includes('spinner') ||
      cls.includes('loading') ||
      cls.includes('uploading') ||
      cls.includes('progress')
    ) {
      return true;
    }
  }

  return false;
}

// Kiểm tra nút Submit có sẵn sàng (không bị disabled do ảnh đang tải lên)
function isSubmitButtonReady(promptEl) {
  const targetInfo = findFlowSubmitTarget(promptEl);
  if (!targetInfo || !targetInfo.el) return false;
  const btn = targetInfo.el;
  if (btn.disabled) return false;
  if (btn.getAttribute?.('aria-disabled') === 'true') return false;
  if (btn.classList?.contains('disabled')) return false;
  const style = window.getComputedStyle(btn);
  if (style.pointerEvents === 'none') return false;
  if (parseFloat(style.opacity || '1') < 0.35) return false;
  return true;
}

// Chờ cho đến khi toàn bộ ảnh đính kèm đã hiển thị và kết thúc tải lên (không còn spinner)
async function waitForAttachmentsReady(expectedCount, maxWaitMs = 25000) {
  const startTime = Date.now();
  let stableReadyCycles = 0;

  while (Date.now() - startTime < maxWaitMs) {
    if (window.__AI_CANVAS_TASK_ABORTED__) {
      throw new Error('Đã dừng bởi người dùng.');
    }
    const promptEl = findFlowPromptElement();
    const chipCount = countAttachedChips(promptEl);
    const isUploading = isAnyAttachmentUploading(promptEl);

    updateBridgeBadgeText(
      `⏳ v5.0: Đang nạp ảnh (${chipCount}/${expectedCount} ảnh hoàn tất)... Vui lòng đợi!`,
      '#f59e0b'
    );

    // Đã đủ số lượng chip đính kèm VÀ không còn thanh tiến trình/spinner loading
    if (chipCount >= expectedCount && !isUploading) {
      stableReadyCycles++;
      // Đợi ổn định liên tiếp 2 chu kỳ thăm dò (1.2 giây) để hoàn tất đồng bộ state
      if (stableReadyCycles >= 2) {
        updateBridgeBadgeText(
          `✅ v5.0: Đã nạp xong ${chipCount} ảnh! Chuẩn bị gửi lệnh...`,
          '#10b981'
        );
        await new Promise((r) => setTimeout(r, 800));
        return true;
      }
    } else {
      stableReadyCycles = 0;
    }

    await new Promise((r) => setTimeout(r, 600));
  }

  console.warn(`[AI Canvas] Timeout chờ ảnh sau ${maxWaitMs}ms, tiếp tục...`);
  return false;
}

// Nạp ảnh tham chiếu theo đúng chế độ:
// Chế độ IMAGE: Nạp tối đa 2 ảnh (Ảnh 1 là Mẫu, Ảnh 2 là Trang phục)
// Chế độ VIDEO: Nạp đúng 1 ảnh duy nhất (Ảnh người mẫu đã thử đồ từ Cột 2)
async function uploadInputImages(images = [], mode = 'IMAGE') {
  const maxCount = mode === 'VIDEO' ? 1 : 2;
  const safeList = (images || []).filter(Boolean).slice(0, maxCount);
  if (safeList.length === 0) return [];

  const initialPrompt = findFlowPromptElement();
  await clearPreviousPromptAttachments(initialPrompt);
  await new Promise((r) => setTimeout(r, 600));

  for (let i = 0; i < safeList.length; i++) {
    const roleText =
      mode === 'VIDEO'
        ? 'Ảnh thử đồ từ Cột 2 (Image 1)'
        : i === 0
        ? 'Mẫu (Image 1)'
        : 'Trang phục (Image 2)';
    updateBridgeBadgeText(`v5.3: Đang nạp ảnh ${i + 1}/${safeList.length} [${roleText}]...`, '#2563eb');
    const file = await base64ToFile(safeList[i], `flow_ref_${Date.now()}_${i + 1}.jpg`);
    await pasteSingleFileIntoPrompt(file, i === 0);

    // Chờ cho ảnh này được giao diện nhận diện chip
    await new Promise((r) => setTimeout(r, 1400));

    // Đợi ảnh này nạp xong trước khi nạp tiếp ảnh sau
    await waitForAttachmentsReady(i + 1, 15000);
  }

  // Đợi cho TẤT CẢ các ảnh hoàn tất 100%
  await waitForAttachmentsReady(safeList.length, 18000);

  // Tính sẵn fingerprint của ảnh đầu vào để loại trừ tuyệt đối, không bắt nhầm
  const fingerprints = [];
  for (const b64 of safeList) {
    const fp = await computeImageFingerprintFromBase64(b64);
    if (fp) fingerprints.push(fp);
  }
  return fingerprints;
}

function ensureFlowCanvasView() {
  try {
    const sideNavLinks = queryAllDeep(document).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.left >= 260 || r.width < 20 || r.height < 16) return false;
      const txt = ((el.innerText || el.textContent || '') + ' ' + (el.getAttribute?.('aria-label') || '')).toLowerCase();
      return (
        txt.includes('tất cả nội dung') ||
        txt.includes('all content') ||
        txt.includes('canvas') ||
        txt.includes('hình ảnh') ||
        txt.includes('images')
      );
    });

    const isUploadsActive = queryAllDeep(document).some((el) => {
      const r = el.getBoundingClientRect();
      if (r.left >= 260) return false;
      const txt = ((el.innerText || el.textContent || '') + ' ' + (el.getAttribute?.('aria-label') || '')).toLowerCase();
      const isActive =
        el.classList?.contains('active') ||
        el.getAttribute?.('aria-selected') === 'true' ||
        el.getAttribute?.('aria-current') === 'page';
      return (txt.includes('tệp tải lên') || txt.includes('uploads')) && isActive;
    });

    if (isUploadsActive && sideNavLinks.length > 0) {
      console.log('[AI Canvas] Đang ở tab Tệp tải lên, tự động chuyển về tab Tất cả nội dung...');
      sideNavLinks[0].click();
    }
  } catch (e) {}
}

async function typePromptTextIntoElement(promptEl, promptText) {
  if (!promptEl) return;
  promptEl.focus();

  if (promptEl.tagName === 'TEXTAREA' || promptEl.tagName === 'INPUT') {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(promptEl, promptText);
    else promptEl.value = promptText;
    promptEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: promptText }));
    promptEl.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // 1. Thử xóa sạch nội dung cũ
    try {
      promptEl.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptEl);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
    } catch (e) {}

    // 2. Gán trực tiếp nội dung văn bản vào phần tử contenteditable
    promptEl.innerText = promptText;
    promptEl.textContent = promptText;

    // Nếu có thẻ con <p> hoặc <span> bên trong, cập nhật luôn
    const childEditable = promptEl.querySelector('p, span, [contenteditable="true"]');
    if (childEditable) {
      childEditable.innerText = promptText;
      childEditable.textContent = promptText;
    }

    // 3. Dispatch toàn bộ sự kiện nhập liệu để trigger React / Angular / Lit framework
    promptEl.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, composed: true, inputType: 'insertText', data: promptText }));
    promptEl.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: promptText }));
    promptEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    promptEl.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    promptEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: ' ', code: 'Space' }));
    promptEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: ' ', code: 'Space' }));

    // 4. Thử execCommand bổ trợ nếu editor yêu cầu document focus
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(promptEl);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertText', false, promptText);
    } catch (e) {}
  }

  await new Promise((r) => setTimeout(r, 200));

  const currentVal = (promptEl.innerText || promptEl.value || promptEl.textContent || '').trim();
  if (currentVal.length < 5) {
    const pr = promptEl.getBoundingClientRect();
    await new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: 'NATIVE_INSERT_PROMPT',
            x: pr.left + pr.width * 0.5,
            y: pr.top + pr.height * 0.5,
            text: promptText
          },
          () => resolve()
        );
      } catch (e) {
        resolve();
      }
    });
  }
}

async function fillPromptAndSubmit(rawPromptText, mode = 'IMAGE') {
  let promptText = String(rawPromptText || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (mode === 'VIDEO' && !/^(create|generate|smooth|authentic|total|tạo|9:16)/i.test(promptText)) {
    promptText = `Create a 9:16 vertical video from this reference image: ${promptText}`;
  }

  let promptEl = findFlowPromptElement();
  if (!promptEl) {
    const isMuse = window.location.hostname.includes('muse.ai');
    throw new Error(
      isMuse
        ? 'Không tìm thấy ô nhập câu lệnh trên Muse AI! Hãy đăng nhập vào giao diện tạo video của Muse AI.'
        : 'Không tìm thấy ô nhập Prompt! Hãy mở trang tạo video trên Muse AI hoặc Google Flow.'
    );
  }

  const isMuse = window.location.hostname.includes('muse.ai');
  updateBridgeBadgeText(`v5.1: Đang nhập Prompt (${isMuse ? 'Muse AI' : (mode === 'VIDEO' ? 'Veo 2' : 'Imagen 3')})...`, '#2563eb');
  await typePromptTextIntoElement(promptEl, promptText);
  await new Promise((r) => setTimeout(r, 500));

  // Đảm bảo tab không bị kẹt ở "Tệp tải lên" để khi tạo xong ảnh sẽ hiển thị ngay
  ensureFlowCanvasView();

  // Chờ nút Gửi sẵn sàng (Muse AI / Google Flow kích hoạt nút Gửi sau khi upload ảnh xong)
  let submitReady = false;
  for (let waitSubmit = 0; waitSubmit < 25; waitSubmit++) {
    promptEl = findFlowPromptElement() || promptEl;
    if (isSubmitButtonReady(promptEl)) {
      submitReady = true;
      break;
    }
    updateBridgeBadgeText(`⏳ v5.1: Đang đợi ảnh đồng bộ xong để kích hoạt nút Gửi (${waitSubmit + 1}/25)...`, '#f59e0b');
    await new Promise((r) => setTimeout(r, 600));
  }

  const targetInfo = findFlowSubmitTarget(promptEl);
  if (!targetInfo || !targetInfo.el) {
    throw new Error(
      isMuse
        ? 'Không tìm thấy nút Gửi (Mũi tên xanh ↑ trên Muse AI)! Hãy kiểm tra ô prompt hoặc bấm Gửi thủ công trên trang Muse AI.'
        : 'Không tìm thấy nút Gửi (Mũi tên trên Google Flow)! Hãy kiểm tra thanh nhập Prompt.'
    );
  }

  if (targetInfo.el.disabled || targetInfo.el.getAttribute?.('aria-disabled') === 'true') {
    throw new Error(
      isMuse
        ? 'Nút Gửi trên Muse AI đang bị khóa (disabled). Vui lòng đợi tải xong ảnh đính kèm hoặc bấm nút Gửi xanh (↑) thủ công trên trang Muse AI!'
        : 'Nút Gửi trên Google Flow vẫn bị khóa (disabled). Vui lòng đợi Google Flow tải xong ảnh đính kèm hoặc bấm Gửi thủ công trên trang Flow!'
    );
  }

  const currentTarget = findFlowSubmitTarget(promptEl) || targetInfo;
  if (currentTarget && currentTarget.el && !currentTarget.el.disabled) {
    const btnLabel = (
      (currentTarget.el.getAttribute?.('aria-label') || '') +
      ' ' +
      (currentTarget.el.title || '') +
      ' ' +
      (currentTarget.el.textContent || '')
    ).toLowerCase();

    if (/\b(stop|dừng|cancel)\b/i.test(btnLabel) || btnLabel.includes('⏹') || btnLabel.includes('■')) {
      console.warn('[AI Canvas] Bỏ qua click vì nút đang ở trạng thái Stop/Dừng.');
    } else {
      updateBridgeBadgeText(`v5.8: Bấm nút Gửi (${isMuse ? '↑ Muse AI' : '➔ Flow'})...`, '#e11d48');
      showClickMarker(currentTarget.x, currentTarget.y);

      // CHỈ GỬI DUY NHẤT 1 LẦN NATIVE HARDWARE CLICK (isTrusted: true), KHÔNG gọi el.click() trước đó
      // để tránh tình trạng nút Send vừa bấm xong biến thành nút Stop và bị click tiếp lần 2 làm dừng AI!
      const nativeRes = await sendNativeCdpWithDockPassThrough({
        type: 'NATIVE_CLICK_AND_ENTER',
        x: currentTarget.x,
        y: currentTarget.y,
        clickOnly: true
      });

      // Chỉ fallback sang DOM click nếu Chrome Debugger không khả dụng
      if (!nativeRes || nativeRes.ok === false) {
        triggerDOMClickAt(currentTarget);
      }
    }
  }

  // Chờ 1.2s để giao diện phản hồi lệnh gửi
  await new Promise((r) => setTimeout(r, 1200));

  const isStopBtnNowActive = (el) => {
    if (!el) return false;
    const pr = el.getBoundingClientRect();
    return Array.from(document.querySelectorAll('button, [role="button"]')).some((b) => {
      const r = b.getBoundingClientRect();
      if (r.left < pr.left || r.right > pr.right + 120 || r.top < pr.top - 40 || r.bottom > pr.bottom + 120) return false;
      const lbl = ((b.getAttribute?.('aria-label') || '') + ' ' + (b.title || '') + ' ' + (b.textContent || '')).toLowerCase();
      return /\b(stop|dừng|cancel)\b/i.test(lbl) || lbl.includes('⏹') || lbl.includes('■');
    });
  };

  // 4. KIỂM TRA XÁC NHẬN ĐÃ GỬI THÀNH CÔNG:
  // Chỉ kích hoạt Enter dự phòng nếu ô nhập vẫn còn nguyên text VÀ nút Stop CHƯA xuất hiện
  // (Tuyệt đối không dùng lịch sử chat cũ để tránh nhầm ở luồng nhiều nhánh)
  let checkPromptEl = findFlowPromptElement();
  let currentText = (checkPromptEl?.innerText || checkPromptEl?.value || '').trim();
  let stopBtnActive = isStopBtnNowActive(checkPromptEl);

  if (currentText.length > 10 && !stopBtnActive) {
    console.log('[AI Canvas] Ô prompt vẫn còn văn bản và AI chưa chạy, kích hoạt Enter dự phòng qua CDP...');
    const pr = checkPromptEl.getBoundingClientRect();
    await sendNativeCdpWithDockPassThrough({
      type: 'NATIVE_CLICK_AND_ENTER',
      x: pr.left + pr.width * 0.5,
      y: pr.top + pr.height * 0.5,
      clickOnly: false
    });
    await new Promise((r) => setTimeout(r, 1200));
    checkPromptEl = findFlowPromptElement();
    currentText = (checkPromptEl?.innerText || checkPromptEl?.value || '').trim();
    stopBtnActive = isStopBtnNowActive(checkPromptEl);
  }

  // 5. XÁC MINH CUỐI CÙNG: Nếu vẫn còn nguyên text trong ô nhập và nút Stop chưa bật => báo lỗi rõ ràng, KHÔNG chạy mù sang bước chờ kết quả
  if (isMuse && currentText.length > 10 && !stopBtnActive) {
    updateBridgeBadgeText('❌ Chưa gửi được lệnh lên Muse AI! Hãy kiểm tra nút Gửi.', '#dc2626');
    throw new Error('Không thể xác nhận đã gửi câu lệnh lên Muse AI (ô nhập vẫn còn chữ). Vui lòng thử lại!');
  }

  updateBridgeBadgeText(`🚀 v5.9: Đã gửi lệnh thành công! Đang đợi kết quả từ ${isMuse ? 'Muse AI' : 'Google Flow'}...`, '#7c3aed');
}

function scrollFlowGalleryToTop() {
  try {
    window.scrollTo({ top: 0, behavior: 'instant' });
    queryAllDeep(document).forEach((el) => {
      if (el.scrollTop > 0 && el.clientHeight > 200) {
        const tag = (el.tagName || '').toLowerCase();
        if (tag !== 'textarea' && el.getAttribute?.('contenteditable') !== 'true') {
          el.scrollTop = 0;
        }
      }
    });
  } catch (e) {}
}

function isAttachmentOrChipElement(el, promptEl = null) {
  if (!el) return false;
  const promptBox = promptEl ? getPromptBoxContainer(promptEl) : null;

  // 1. Nếu phần tử nằm trực tiếp bên trong khung soạn thảo Prompt (composer box) -> chắc chắn là chip đính kèm
  if (promptBox && promptBox.contains(el)) {
    return true;
  }

  // 2. Kiểm tra các thẻ cha gần nhất xem có phải chip đính kèm có nút xóa hay không
  let curr = el;
  for (let i = 0; i < 4 && curr && curr !== document.body; i++) {
    const cls = (curr.className || '').toString().toLowerCase();
    const testid = (curr.getAttribute?.('data-testid') || '').toLowerCase();
    const aria = (curr.getAttribute?.('aria-label') || '').toLowerCase();

    if (
      cls.includes('chip') ||
      testid.includes('chip') ||
      aria.includes('đính kèm') ||
      aria.includes('remove attachment')
    ) {
      return true;
    }
    if (curr.querySelector?.('button[aria-label*="Remove"], button[aria-label*="Xóa"], [data-testid*="remove"]')) {
      return true;
    }
    curr = curr.parentElement;
  }

  // 3. Kiểm tra tọa độ nằm gọn bên trong khung composer box (không quét lên trên 220px vào luồng chat!)
  if (promptBox) {
    const br = promptBox.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (
      r.top >= br.top - 5 &&
      r.bottom <= br.bottom + 5 &&
      r.left >= br.left - 10 &&
      r.right <= br.right + 10
    ) {
      return true;
    }
  }

  return false;
}

function isValidGeneratedMedia(el, src, promptEl = null, inputFingerprints = [], candidateFingerprint = null, mode = 'IMAGE') {
  if (!src) return false;
  if (/googleusercontent\.com\/(a|ogw)\//i.test(src)) return false; // Avatar/profile icon
  const isMuse = window.location.hostname.includes('muse.ai');

  // 1. Không bao giờ nhận chip đính kèm trong ô prompt
  if (isAttachmentOrChipElement(el, promptEl)) return false;

  // 2. Loại trừ phần tử thuộc Header, Navigation, Tooltip
  if (el.closest?.('header, nav, aside, [role="tooltip"], [role="menu"]')) {
    return false;
  }
  if (!isMuse && el.closest?.('[role="dialog"], .mat-mdc-menu-panel, .cdk-overlay-pane, .dialog, .modal, .popup')) {
    return false;
  }

  // 3. Phải nằm trong khu vực hiển thị Workspace / Chat Feed / Gallery chính
  const rect = el.getBoundingClientRect();
  const minLeft = isMuse ? 50 : 240; // Muse AI thanh bar bên trái chỉ rộng 60px
  if (rect.left < minLeft) return false;
  if (rect.top < 30) return false; // Loại bỏ header/topbar
  const minDimension = isMuse ? 60 : 160;
  if (rect.width < minDimension || rect.height < minDimension) return false; // Loại bỏ icon nhỏ

  // Trên Muse AI: Loại bỏ avatar mascot hoặc widget bên panel phải
  if (isMuse && rect.left > window.innerWidth * 0.85) return false;

  // 4. Nếu là VIDEO: Chấp nhận video có kích thước hợp lệ
  if (el.tagName === 'VIDEO') {
    return true;
  }

  // 5. Kiểm tra kích thước tự nhiên: Ảnh sinh bởi AI
  if (el.tagName === 'IMG') {
    if (!el.complete) {
      try { el.loading = 'eager'; } catch (e) {}
      return false;
    }
    const nw = el.naturalWidth || 0;
    const nh = el.naturalHeight || 0;
    const minNatural = isMuse ? (mode === 'VIDEO' ? 80 : 120) : 480;
    if (nw < minNatural || nh < minNatural) return false;
  }

  // 6. SO SÁNH VỚI ẢNH ĐẦU VÀO: Chỉ so sánh loại trừ khi tạo Ảnh (mode === 'IMAGE')
  if (mode === 'IMAGE' && candidateFingerprint && Array.isArray(inputFingerprints) && inputFingerprints.length > 0) {
    for (const inFp of inputFingerprints) {
      if (inFp && isFingerprintMatch(candidateFingerprint, inFp)) {
        console.warn('⚠️ [FlowContent] Bỏ qua phần tử vì trùng với ảnh đầu vào (Input Reference):', src.slice(0, 80));
        return false;
      }
    }
  }

  return true;
}

function dismissAnyOpenModal() {
  // Chỉ quét các thẻ modal/dialog thực sự, tránh queryAllDeep toàn trang gây treo trình duyệt
  const modalCandidates = Array.from(
    document.querySelectorAll('[role="dialog"], [aria-modal="true"], [class*="modal"]')
  );
  if (modalCandidates.length === 0) return;

  const taskModals = modalCandidates.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 250 || r.height < 180) return false;
    const txt = (el.textContent || '').slice(0, 800).toLowerCase();
    return (
      txt.includes('tạo video ai') ||
      txt.includes('tóm tắt') ||
      txt.includes('hoàn tất') ||
      txt.includes('no video was actually created') ||
      txt.includes('chia sẻ') ||
      txt.includes('sao chép liên kết') ||
      txt.includes('copy link')
    );
  });

  if (taskModals.length === 0) return;

  try {
    const escDown = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
    document.dispatchEvent(escDown);
  } catch (e) {}

  for (const modal of taskModals) {
    const mr = modal.getBoundingClientRect();
    const closeCandidates = Array.from(modal.querySelectorAll('button, [role="button"]')).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.width > 70 || r.height < 12 || r.height > 70) return false;
      const isTopRight = r.top >= mr.top - 15 && r.top <= mr.top + 100 && r.right >= mr.right - 100 && r.right <= mr.right + 25;
      const label = ((el.getAttribute?.('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.textContent || '')).toLowerCase();
      const hasCloseTxt = /close|đóng|dismiss|x/i.test(label) || label.includes('✕') || label.includes('×');
      const hasSvg = !!el.querySelector?.('svg');
      return isTopRight && (hasCloseTxt || hasSvg);
    });

    for (const btn of closeCandidates) {
      try {
        btn.click();
      } catch (e) {}
    }

    try {
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('opacity', '0', 'important');
      modal.style.setProperty('pointer-events', 'none', 'important');
    } catch (e) {}
  }
}

function recordAllCurrentMediaUrls(existingSet) {
  if (!existingSet) return;
  const getMediaUrl = (el) => el.currentSrc || el.src || el.querySelector?.('source')?.src;
  queryAllDeep(document)
    .filter((el) => el.tagName === 'IMG' || el.tagName === 'VIDEO')
    .forEach((el) => {
      const u = getMediaUrl(el);
      if (u) existingSet.add(u);
      try {
        el.setAttribute('data-ai-canvas-pre-existing', 'true');
      } catch (e) {}
    });
}

function findLastUserPromptRect(sentPromptText, promptEl) {
  const snippet = String(sentPromptText || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 48);
  if (!snippet || snippet.length < 8) return null;

  const candidates = Array.from(document.querySelectorAll('div, p, span')).filter((el) => {
    if (promptEl && (el === promptEl || promptEl.contains(el) || el.contains(promptEl))) return false;
    if (el.closest?.('#ai-canvas-flow-badge, header, nav, aside')) return false;
    // Tuyệt đối không chọn thẻ cha bao trùm cả ảnh/video hoặc thẻ cha ngoài cùng
    if (el.querySelector?.('img, video')) return false;
    const txt = (el.textContent || '').trim();
    if (!txt.includes(snippet) || txt.length > 4000) return false;
    const hasChildWithSnippet = Array.from(el.children || []).some((ch) => (ch.textContent || '').includes(snippet));
    if (hasChildWithSnippet) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 20 || r.left < 60) return false;
    return true;
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const ra = a.getBoundingClientRect();
    const rb = b.getBoundingClientRect();
    return rb.bottom - ra.bottom;
  });
  return candidates[0].getBoundingClientRect();
}

function getAssistantTextBelowPrompt(userPromptRect, promptEl) {
  if (!userPromptRect) return '';
  const blocks = Array.from(document.querySelectorAll('div, p')).filter((el) => {
    if (promptEl && (el === promptEl || promptEl.contains(el) || el.contains(promptEl))) return false;
    if (el.closest?.('#ai-canvas-flow-badge, #ai-canvas-flow-log-panel, #ai-canvas-muse-tool-dock, header, nav, aside')) {
      return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width < 60 || r.height < 16) return false;
    if (r.top < userPromptRect.bottom - 5) return false;
    // Chỉ lấy thẻ lá / đoạn văn bản thực sự, tránh gom cả thẻ cha lớn
    if (el.querySelector?.('div, p')) return false;
    const txt = (el.textContent || '').trim();
    return txt.length > 0;
  });

  return blocks.map((b) => (b.textContent || '').trim()).join(' ').trim();
}

function captureNewMediaOutput(
  existingSet,
  inputFingerprints = [],
  initialFailCount = 0,
  mode = 'IMAGE',
  timeoutMs = 300000,
  submitTimestamp = Date.now(),
  sentPromptText = ''
) {
  if (typeof window.__AI_CANVAS_CANCEL_CURRENT_TASK__ === 'function') {
    try {
      window.__AI_CANVAS_CANCEL_CURRENT_TASK__();
    } catch (e) {}
  }

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let lastApproveClickAt = 0;
    const isMuse = window.location.hostname.includes('muse.ai');
    // Chờ tối thiểu hợp lý để không bắt nhầm lúc vừa bấm gửi, nhưng bắt cực nhanh ngay khi AI trả kết quả
    const MIN_WAIT_MS = isMuse ? (mode === 'VIDEO' ? 10000 : 3000) : (mode === 'VIDEO' ? 12000 : 4000);

    let scheduleTimer = null;
    const cleanup = () => {
      isResolved = true;
      clearTimeout(timer);
      clearTimeout(scheduleTimer);
      clearInterval(pollInterval);
      observer.disconnect();
      if (window.__AI_CANVAS_CANCEL_CURRENT_TASK__ === cancelTask) {
        window.__AI_CANVAS_CANCEL_CURRENT_TASK__ = null;
      }
    };

    const cancelTask = () => {
      if (isResolved) return;
      cleanup();
      reject(new Error('Tác vụ trước đã được hủy để nhường chỗ cho lệnh mới.'));
    };

    window.__AI_CANVAS_CANCEL_CURRENT_TASK__ = cancelTask;

    const timer = setTimeout(() => {
      if (isResolved) return;
      cleanup();
      reject(new Error(`Quá thời gian chờ ${isMuse ? 'Muse AI' : 'Google Flow'} sinh ${mode === 'VIDEO' ? 'Video' : 'Ảnh'} (${Math.round(timeoutMs / 1000)}s)`));
    }, timeoutMs);

    const checkAutoApproveButtons = () => {
      if (Date.now() - lastApproveClickAt < 3000) return;
      const allClickable = isMuse
        ? Array.from(document.querySelectorAll('button, [role="button"]'))
        : queryAllDeep(document).filter((el) => {
            const tag = (el.tagName || '').toLowerCase();
            return tag === 'button' || el.getAttribute?.('role') === 'button' || tag.includes('button');
          });

      const approveBtn =
        allClickable.find((el) => /luôn phê duyệt|always approve/i.test((el.textContent || '').trim())) ||
        allClickable.find((el) => /^(\s*✓?\s*)?(phê duyệt|approve|xác nhận|confirm)$/i.test((el.textContent || '').trim()));

      if (approveBtn) {
        const r = approveBtn.getBoundingClientRect();
        if (r.width > 20 && r.height > 16) {
          lastApproveClickAt = Date.now();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          updateBridgeBadgeText('⚡ v5.7: Tự động bấm "Phê duyệt"...', '#f59e0b');
          triggerDOMClickAt({ el: approveBtn, x: cx, y: cy });
          try {
            chrome.runtime.sendMessage({ type: 'NATIVE_CLICK_AND_ENTER', x: cx, y: cy, clickOnly: true });
          } catch (e) {}
        }
      }
    };

    let isChecking = false;
    let hasAutoConfirmedMuse = false;
    let lastModalDismissAt = 0;
    let lastWakeupPulseAt = 0;
    let textOnlySince = null;

    const pulseTabWakeup = async () => {
      try {
        await new Promise((resolve) => {
          const t = setTimeout(resolve, 1200);
          chrome.runtime.sendMessage({ type: 'PULSE_TAB_WAKEUP' }, () => {
            clearTimeout(t);
            resolve();
          });
        });
      } catch (e) {}
    };

    const checkMedia = async () => {
      if (isResolved || isChecking) return;
      isChecking = true;
      try {
        const now = Date.now();
        if (isMuse && now - lastModalDismissAt >= 3000) {
          lastModalDismissAt = now;
          dismissAnyOpenModal();
        }
        checkAutoApproveButtons();

        // 1. Kiểm tra thời gian tối thiểu kể từ khi bấm Gửi
        const elapsed = now - submitTimestamp;
        if (elapsed < MIN_WAIT_MS) {
          updateBridgeBadgeText(
            `⏳ ${isMuse ? 'Muse AI' : 'Google Flow'} đang xử lý... (${Math.max(1, Math.round((MIN_WAIT_MS - elapsed) / 1000))}s)`,
            '#e11d48'
          );
          return;
        }

        // TỰ ĐỘNG THÚC ĐẨY (Auto-Nudge) NẾU MUSE AI DỪNG LẠI Ở BƯỚC "SẴN SÀNG":
        const bodyText = document.body.textContent || '';
        if (
          isMuse &&
          !hasAutoConfirmedMuse &&
          elapsed > 4000 &&
          (bodyText.includes('no video was actually created') ||
            bodyText.includes('got ready to make your AI video') ||
            bodyText.includes('sẵn sàng tạo video'))
        ) {
          hasAutoConfirmedMuse = true;
          updateBridgeBadgeText('⚡ Phát hiện Muse AI chờ xác nhận -> Tự động xác nhận "Tạo video ngay"...', '#f59e0b');
          dismissAnyOpenModal();

          const promptTarget = findFlowPromptElement();
          if (promptTarget) {
            const confirmTxt = mode === 'VIDEO' ? 'Yes, create and generate the video now! Execute media tool immediately.' : 'Yes, generate the image now!';
            await typePromptTextIntoElement(promptTarget, confirmTxt);
            await new Promise((r) => setTimeout(r, 400));
            const btnTarget = findMuseSubmitTarget(promptTarget);
            if (btnTarget) {
              chrome.runtime.sendMessage({
                type: 'NATIVE_CLICK_AND_ENTER',
                x: btnTarget.x,
                y: btnTarget.y,
                clickOnly: true
              });
            }
          }
        }

        // Nếu tab đang chạy ngầm (document.hidden) và đã qua 8s (lặp lại mỗi 8s):
        // Nháy sang tab Muse AI ~350ms TRƯỚC khi kiểm tra nút Stop & ảnh mới để Chrome đánh thức React/DOM rồi trả ngay về trang Tool!
        if (document.hidden && elapsed > 8000 && now - lastWakeupPulseAt >= 8000) {
          lastWakeupPulseAt = now;
          updateBridgeBadgeText(
            `⚡ Đánh thức tab ${isMuse ? 'Muse AI' : 'Flow'} để lấy kết quả rồi tự quay về trang Tool...`,
            '#3b82f6'
          );
          await pulseTabWakeup();
        }

        // 2. Kiểm tra nút Dừng (Stop / ■) trong thanh nhập Prompt (hoặc thanh tiến trình trên Google Flow)
        const promptEl = findFlowPromptElement();
        const prBusy = promptEl ? promptEl.getBoundingClientRect() : null;

        const isMuseBusy = isMuse && (() => {
          if (prBusy) {
            const btns = document.querySelectorAll('button, [role="button"]');
            for (const el of btns) {
              const r = el.getBoundingClientRect();
              if (r.width < 12 || r.height < 12) continue;
              if (r.left < prBusy.left || r.right > prBusy.right + 100) continue;
              if (r.top < prBusy.top - 40 || r.bottom > prBusy.bottom + 120) continue;
              const lbl = ((el.getAttribute?.('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.textContent || '')).toLowerCase();
              if (/\b(stop|dừng|cancel)\b/i.test(lbl) || lbl.includes('⏹')) return true;
            }
          }
          return false;
        })();

        const flowProgressActive = !isMuse && queryAllDeep(document).some((el) => {
          if (el.closest?.('#ai-canvas-flow-badge, header, nav, aside')) return false;
          const r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 2 || r.width > 900 || r.height > 900) return false;
          const role = el.getAttribute?.('role') || '';
          const ariaBusy = el.getAttribute?.('aria-busy') === 'true';
          const cls = (el.className || '').toString().toLowerCase();
          return role === 'progressbar' || ariaBusy || cls.includes('animate-spin') || cls.includes('loading-spinner') || cls.includes('progress-bar');
        });

        if (isMuseBusy || flowProgressActive) {
          updateBridgeBadgeText(
            `⚡ ${isMuse ? 'Muse AI' : 'Google Flow'} đang thực thi sinh ${mode === 'VIDEO' ? 'Video' : 'Ảnh'}... (${Math.round(elapsed / 1000)}s)`,
            '#f59e0b'
          );
          return; // Đang chạy, chưa xong!
        }

        if (!isMuse) scrollFlowGalleryToTop();
        const promptRect = promptEl ? promptEl.getBoundingClientRect() : null;
        const userPromptRect = isMuse ? findLastUserPromptRect(sentPromptText, promptEl) : null;

        // Luôn quét cả thẻ VIDEO lẫn IMG (vì trên Muse AI video hoàn tất thường đi kèm thumbnail poster hoặc player)
        const allNodes = isMuse
          ? Array.from(document.querySelectorAll('img, video'))
          : queryAllDeep(document).filter((el) => el.tagName === 'IMG' || el.tagName === 'VIDEO');

        // Trên Muse AI: Sắp xếp từ DƯỚI LÊN TRÊN (mới nhất ở đáy khung chat lên đầu)
        // Trên Flow: Ưu tiên kích thước lớn nhất và từ trên xuống
        allNodes.sort((a, b) => {
          if (mode === 'VIDEO') {
            if (a.tagName === 'VIDEO' && b.tagName !== 'VIDEO') return -1;
            if (b.tagName === 'VIDEO' && a.tagName !== 'VIDEO') return 1;
          }
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
          if (isMuse) {
            if (Math.abs(rb.bottom - ra.bottom) > 30) return rb.bottom - ra.bottom;
            return ra.left - rb.left;
          }
          const areaA = ra.width * ra.height;
          const areaB = rb.width * rb.height;
          if (Math.abs(areaB - areaA) > 10000) return areaB - areaA;
          return ra.top - rb.top;
        });

        for (const el of allNodes) {
          // BẮT BUỘC: Bỏ qua mọi phần tử đã tồn tại trên trang từ trước khi gửi prompt!
          if (el.getAttribute?.('data-ai-canvas-pre-existing') === 'true') continue;

          const src = el.currentSrc || el.src || el.querySelector?.('source')?.src;
          if (!src || existingSet.has(src)) continue;

          // Lọc: Phải nằm trong Chat Feed / Gallery chính, không nằm trong toolbar hay sidebar
          if (!isValidGeneratedMedia(el, src, promptEl, inputFingerprints, null, mode)) continue;

          // BẢO VỆ ĐẶC BIỆT CHO MUSE AI:
          // Ảnh kết quả của Muse AI luôn nằm BÊN DƯỚI bong bóng câu lệnh vừa gửi của người dùng
          // (Ngoại lệ: Thẻ <video> mới mở trong modal trình phát toàn màn hình)
          if (isMuse) {
            const isVideoModal = mode === 'VIDEO' && el.tagName === 'VIDEO' && Boolean(el.closest?.('[role="dialog"], [aria-modal="true"]'));
            if (!isVideoModal) {
              const er = el.getBoundingClientRect();
              if (userPromptRect) {
                if (er.top < userPromptRect.bottom - 12) continue;
              } else if (promptRect && er.left > promptRect.left + promptRect.width * 0.45) {
                continue;
              }
            }
          }

          // Nếu ở mode VIDEO: Bắt buộc đã trôi qua ít nhất 18s
          if (mode === 'VIDEO' && elapsed < 18000) {
            updateBridgeBadgeText(`⏳ Đang đợi Muse AI render xong Video 9:16... (${Math.round(elapsed / 1000)}s / 20s)`, '#3b82f6');
            return;
          }

          // Chỉ so khớp fingerprint loại trừ ảnh đầu vào khi ở mode IMAGE
          // (Khi ở mode VIDEO: poster video tạo ra bắt buộc phải giống người mẫu trong ảnh đầu vào, không được loại trừ!)
          let prefetchedBase64 = null;
          if (mode === 'IMAGE' && el.tagName === 'IMG' && Array.isArray(inputFingerprints) && inputFingerprints.length > 0) {
            let candFp = computeImageFingerprintFromElement(el);
            if (!candFp) {
              prefetchedBase64 = await convertFlowUrlToBase64(src, el);
              if (prefetchedBase64 && prefetchedBase64.startsWith('data:')) {
                candFp = await computeImageFingerprintFromBase64(prefetchedBase64);
              }
            }
            if (candFp) {
              const matchesInput = inputFingerprints.some((inFp) => inFp && isFingerprintMatch(candFp, inFp));
              if (matchesInput) {
                console.warn('⚠️ [FlowContent] Bỏ qua vì trùng vân tay ảnh đầu vào:', src.slice(0, 80));
                continue;
              }
            }
          }

          // Ở mode VIDEO: TUYỆT ĐỐI CHỈ NHẬN VIDEO THỰC SỰ (thẻ <video> hoặc link .mp4/.webm), KHÔNG TRẢ VỀ ẢNH POSTER!
          let finalMediaSrc = src;
          let resolvedDomEl = el;
          if (mode === 'VIDEO') {
            if (el.tagName === 'VIDEO') {
              finalMediaSrc = el.currentSrc || el.src || el.querySelector?.('source')?.src || '';
            } else {
              let foundVideoUrl = '';
              let anc = el.parentElement;
              for (let d = 0; d < 6 && anc && anc !== document.body; d++) {
                const videoTag = anc.querySelector?.('video, source');
                const vUrl = videoTag ? (videoTag.currentSrc || videoTag.src || '') : '';
                if (vUrl && !existingSet.has(vUrl)) {
                  foundVideoUrl = vUrl;
                  resolvedDomEl = videoTag;
                  break;
                }
                const mp4Link = anc.querySelector?.('a[href*=".mp4"], a[download*=".mp4"], a[href*="video"]');
                const linkUrl = mp4Link ? (mp4Link.href || mp4Link.getAttribute('href') || '') : '';
                if (linkUrl && !existingSet.has(linkUrl)) {
                  foundVideoUrl = linkUrl;
                  break;
                }
                anc = anc.parentElement;
              }

              if (!foundVideoUrl) {
                // Nếu Muse AI mới chỉ hiển thị thumbnail ảnh có nút Play ▶ mà chưa gắn thẻ <video>:
                // Click 1 lần vào thẻ thumbnail để mở trình phát <video> lấy link MP4 thật
                if (isMuse && !el.dataset.aiCanvasVideoClicked) {
                  el.dataset.aiCanvasVideoClicked = 'true';
                  try {
                    const clickableCard = el.closest?.('button, [role="button"], a') || el;
                    clickableCard.click();
                    updateBridgeBadgeText('🎬 Đang mở trình phát để trích xuất link Video MP4 thật...', '#3b82f6');
                  } catch (e) {}
                  return;
                }
                // Vẫn chưa có thẻ <video> hoặc link .mp4 => bỏ qua ảnh poster, tiếp tục đợi <video>
                continue;
              }
              finalMediaSrc = foundVideoUrl;
            }

            if (!finalMediaSrc || existingSet.has(finalMediaSrc)) continue;
          }

          existingSet.add(src);
          existingSet.add(finalMediaSrc);
          cleanup();

          // Nếu vừa mở modal trình phát video để lấy URL thì đóng lại gọn gàng
          if (mode === 'VIDEO' && isMuse) {
            try {
              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
            } catch (e) {}
          }

          updateBridgeBadgeText(`✅ v6.0: Bắt được kết quả ${mode === 'VIDEO' ? 'Video MP4' : 'Ảnh'} từ ${isMuse ? 'Muse AI' : 'Google Flow'}! Đang đồng bộ về bàn vẽ...`, '#10b981');
          let base64Data = finalMediaSrc;
          if (mode === 'VIDEO') {
            if (finalMediaSrc.startsWith('blob:')) {
              base64Data = await convertFlowUrlToBase64(finalMediaSrc, null);
            }
          } else {
            base64Data = prefetchedBase64 && finalMediaSrc === src
              ? prefetchedBase64
              : await convertFlowUrlToBase64(finalMediaSrc, resolvedDomEl);
          }
          resolve({ rawUrl: finalMediaSrc, base64Data: base64Data || finalMediaSrc });
          return;
        }

        // Kiểm tra nếu Muse AI đã trả lời xong nhưng CHỈ TRẢ VỀ CHỮ (từ chối tạo hoặc hỏi lại, không có ảnh/video)
        if (isMuse && userPromptRect && !isMuseBusy) {
          const assistantText = getAssistantTextBelowPrompt(userPromptRect, promptEl);
          if (assistantText.length > 12) {
            const isExplicitRefusal =
              /không tạo được|không thể tạo|không thể thực hiện|từ chối|bạn muốn mình làm theo hướng nào|cannot generate|cannot create|unable to generate|unable to create|failed to generate/i.test(
                assistantText
              );

            if (isExplicitRefusal) {
              const snippet = assistantText.slice(0, 150);
              cleanup();
              const errMsg = `Muse AI từ chối / chỉ trả về chữ (không tạo được ${mode === 'VIDEO' ? 'Video' : 'Ảnh'}): "${snippet}"`;
              updateBridgeBadgeText(`❌ ${errMsg}`, '#dc2626');
              reject(new Error(errMsg));
              return;
            }

            if (elapsed > 6000) {
              if (!textOnlySince) textOnlySince = now;
              if (now - textOnlySince >= 2500) {
                const snippet = assistantText.slice(0, 150);
                cleanup();
                const errMsg = `Muse AI chỉ trả về chữ, không xuất ${mode === 'VIDEO' ? 'Video' : 'Ảnh'}: "${snippet}"`;
                updateBridgeBadgeText(`❌ ${errMsg}`, '#dc2626');
                reject(new Error(errMsg));
                return;
              }
            }
          } else {
            textOnlySince = null;
          }
        }

        const currentFailCount = (bodyText.match(/Rất tiếc, không tạo được/g) || []).length;
        if (currentFailCount > initialFailCount) {
          await new Promise((r) => setTimeout(r, 4000));
          if (isResolved) return;
          cleanup();
          updateBridgeBadgeText('⚠️ Bị từ chối tạo (Hãy đổi ảnh hoặc câu lệnh)', '#dc2626');
          reject(
            new Error(
              `${isMuse ? 'Muse AI' : 'Google Flow'} báo không thành công. Hãy thử đổi câu lệnh Prompt!`
            )
          );
          return;
        }

        updateBridgeBadgeText(
          `🔍 Đang chờ ${isMuse ? 'Muse AI' : 'Google Flow'} xuất ${mode === 'VIDEO' ? 'Video' : 'Ảnh'}... (${Math.round(elapsed / 1000)}s)`,
          '#f59e0b'
        );
      } catch (err) {
        console.warn(`⚠️ [FlowContent v5.1] Lỗi khi quét Media mới:`, err);
      } finally {
        isChecking = false;
      }
    };

    const scheduleCheckMedia = () => {
      if (isResolved || scheduleTimer) return;
      scheduleTimer = setTimeout(() => {
        scheduleTimer = null;
        checkMedia();
      }, 350);
    };

    const observer = new MutationObserver((mutations) => {
      // Bỏ qua các thay đổi do chính badge hoặc marker của extension tạo ra để tránh lặp vô tận
      const hasExternalMutation = mutations.some((m) => {
        const t = m.target;
        if (!t || !t.closest) return true;
        return (
          !t.closest('#ai-canvas-flow-badge') &&
          !t.closest('#ai-canvas-flow-log-panel') &&
          !t.closest('#ai-canvas-muse-tool-dock') &&
          !t.closest('#ai-canvas-click-marker')
        );
      });
      if (hasExternalMutation) {
        scheduleCheckMedia();
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    const pollInterval = setInterval(checkMedia, 600);
  });
}

window.__AI_CANVAS_FLOW_TASK_RUNNING__ = window.__AI_CANVAS_FLOW_TASK_RUNNING__ || false;
window.__AI_CANVAS_TASK_ABORTED__ = window.__AI_CANVAS_TASK_ABORTED__ || false;

window.__AI_CANVAS_RUN_FLOW_TASK__ = async function (payload = {}) {
  if (window.__AI_CANVAS_FLOW_TASK_RUNNING__) {
    console.warn('⚠️ [FlowContent] Đã có tác vụ đang chạy, bỏ qua lệnh chạy trùng lặp!');
    return { ok: false, error: 'Đang có tác vụ khác đang chạy trên tab này.' };
  }
  window.__AI_CANVAS_FLOW_TASK_RUNNING__ = true;
  window.__AI_CANVAS_TASK_ABORTED__ = false;

  try {
    const { mode = 'IMAGE', images = [], prompt = '' } = payload;
    const isMuse = window.location.hostname.includes('muse.ai');

    // Đợi 1 giây để giao diện Muse AI ổn định trước khi nhận lượt mới
    if (isMuse) {
      if (document.hidden) {
        try {
          await new Promise((resolve) => {
            const t = setTimeout(resolve, 1000);
            chrome.runtime.sendMessage({ type: 'PULSE_TAB_WAKEUP' }, () => {
              clearTimeout(t);
              resolve();
            });
          });
        } catch (e) {}
      }
      dismissAnyOpenModal();
      await new Promise((r) => setTimeout(r, 800));
    }

    if (typeof window.__AI_CANVAS_CANCEL_CURRENT_TASK__ === 'function') {
      try {
        window.__AI_CANVAS_CANCEL_CURRENT_TASK__();
      } catch (e) {}
    }

    scrollFlowGalleryToTop();
    const initialFailCount = ((document.body.innerText || '').match(/Rất tiếc, không tạo được/g) || []).length;

    // Ghi nhận toàn bộ ảnh cũ trên trang TRƯỚC KHI BẤM GỬI
    const existingUrls = new Set();
    recordAllCurrentMediaUrls(existingUrls);

    let inputFingerprints = [];
    if (images && images.length > 0) {
      inputFingerprints = await uploadInputImages(images, mode);
      // Ghi nhận toàn bộ chip đính kèm vừa xuất hiện vào danh sách ảnh cũ
      recordAllCurrentMediaUrls(existingUrls);
    }

    // Bấm gửi và ghi nhận thời điểm submit
    const submitTimestamp = Date.now();
    await fillPromptAndSubmit(prompt, mode);

    const timeoutMs = mode === 'VIDEO' ? 600000 : 300000;
    const output = await captureNewMediaOutput(
      existingUrls,
      inputFingerprints,
      initialFailCount,
      mode,
      timeoutMs,
      submitTimestamp,
      prompt
    );
    updateBridgeBadgeText(`✅ v5.5: Đã nhận kết quả thành công từ ${isMuse ? 'Muse AI' : 'Google Flow'}!`, 'rgba(16,185,129,0.95)');
    return {
      ok: true,
      mode,
      rawUrl: output.rawUrl,
      base64: output.base64Data
    };
  } finally {
    window.__AI_CANVAS_FLOW_TASK_RUNNING__ = false;
  }
};

window.__AI_CANVAS_MESSAGE_DISPATCHER__ = (message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'PING_CHECK') {
    sendResponse({ ok: true, version: '4.1.0' });
    return false;
  }

  if (message.type === 'CANCEL_ACTIVE_FLOW_TASK') {
    window.__AI_CANVAS_TASK_ABORTED__ = true;
    window.__AI_CANVAS_FLOW_TASK_RUNNING__ = false;
    if (typeof window.__AI_CANVAS_CANCEL_CURRENT_TASK__ === 'function') {
      try {
        window.__AI_CANVAS_CANCEL_CURRENT_TASK__();
      } catch (e) {}
    }

    // Nếu Muse AI đang chạy dở (có nút Stop ■), bấm dừng luôn và dọn sạch ô nhập về trạng thái ban đầu
    (async () => {
      try {
        const promptEl = findFlowPromptElement();
        if (promptEl) {
          const pr = promptEl.getBoundingClientRect();
          const stopBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find((b) => {
            const r = b.getBoundingClientRect();
            if (r.left < pr.left || r.right > pr.right + 120 || r.top < pr.top - 40 || r.bottom > pr.bottom + 120) return false;
            const lbl = ((b.getAttribute?.('aria-label') || '') + ' ' + (b.title || '') + ' ' + (b.textContent || '')).toLowerCase();
            return /\b(stop|dừng|cancel)\b/i.test(lbl) || lbl.includes('⏹') || lbl.includes('■');
          });
          if (stopBtn) {
            const sr = stopBtn.getBoundingClientRect();
            await sendNativeCdpWithDockPassThrough({
              type: 'NATIVE_CLICK_AND_ENTER',
              x: sr.left + sr.width / 2,
              y: sr.top + sr.height / 2,
              clickOnly: true
            });
          }
          await clearPreviousPromptAttachments(promptEl);
        }
      } catch (e) {}
      updateBridgeBadgeText('⏹️ Đã dừng toàn bộ tiến trình! Sẵn sàng chạy lại.', 'rgba(15,23,42,0.92)');
    })();

    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'PING_FROM_CANVAS') {
    flashPingBadge();
    sendResponse({ ok: true, pageTitle: document.title, url: location.href, version: '4.1.0' });
    return false;
  }

  if (message.type === 'EXECUTE_FLOW_NODE') {
    window
      .__AI_CANVAS_RUN_FLOW_TASK__(message.payload || {})
      .then((res) => sendResponse(res))
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
};

(function mountFlowListeners() {
  if (window.__AI_CANVAS_HEARTBEAT_TIMER__) {
    clearInterval(window.__AI_CANVAS_HEARTBEAT_TIMER__);
  }

  window.__AI_CANVAS_HEARTBEAT_TIMER__ = setInterval(() => {
    try {
      mountConnectionBadge();
      if (chrome && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          type: 'FLOW_TAB_HEARTBEAT',
          url: location.href,
          title: document.title
        });
      }
    } catch (e) {}
  }, 1500);

  const listenerKey = '__AI_CANVAS_LISTENER_BOUND_' + (chrome?.runtime?.id || 'default');
  if (!window[listenerKey]) {
    window[listenerKey] = true;
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (typeof window.__AI_CANVAS_MESSAGE_DISPATCHER__ === 'function') {
        return window.__AI_CANVAS_MESSAGE_DISPATCHER__(message, sender, sendResponse);
      }
      return false;
    });
  }

  if (window.__AI_CANVAS_DIRECT_WIN_HANDLER__) {
    window.removeEventListener('message', window.__AI_CANVAS_DIRECT_WIN_HANDLER__);
  }
  const directWinHandler = async (event) => {
    if (!event.data || event.data.source !== 'AI_CANVAS_WEB_DIRECT') return;
    const { type, jobId, payload } = event.data;

    if (type === 'GET_POOL_STATUS') {
      event.source?.postMessage(
        {
          source: 'AI_CANVAS_EXTENSION',
          type: 'GET_POOL_STATUS_RESULT',
          jobId,
          response: { connected: true, openFlowTabs: 1, maxConcurrentTabs: 3 }
        },
        '*'
      );
      return;
    }

    if (type === 'PING_FLOW_TAB') {
      flashPingBadge();
      event.source?.postMessage(
        {
          source: 'AI_CANVAS_EXTENSION',
          type: 'PING_FLOW_TAB_RESULT',
          jobId,
          response: { success: true, tabId: 'direct-flow-window', tabUrl: location.href }
        },
        '*'
      );
      return;
    }

    if (type === 'QUEUE_FLOW_JOB') {
      try {
        const res = await window.__AI_CANVAS_RUN_FLOW_TASK__(payload || {});
        event.source?.postMessage(
          {
            source: 'AI_CANVAS_EXTENSION',
            type: 'QUEUE_FLOW_JOB_RESULT',
            jobId,
            response: { success: true, ...res }
          },
          '*'
        );
      } catch (err) {
        event.source?.postMessage(
          {
            source: 'AI_CANVAS_EXTENSION',
            type: 'QUEUE_FLOW_JOB_RESULT',
            jobId,
            response: { success: false, ok: false, error: err.message }
          },
          '*'
        );
      }
    }
  };
  window.__AI_CANVAS_DIRECT_WIN_HANDLER__ = directWinHandler;
  window.addEventListener('message', directWinHandler);

  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage({ source: 'AI_CANVAS_EXTENSION', type: 'FLOW_WINDOW_CONNECTED' }, '*');
    } catch (e) {}
  }
})();
