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

function mountConnectionBadge() {
  const isMuse = window.location.hostname.includes('muse.ai');
  let badge = document.getElementById('ai-canvas-flow-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'ai-canvas-flow-badge';
    (document.body || document.documentElement).appendChild(badge);
  }
  badge.style.cssText =
    'position:fixed;bottom:18px;left:18px;z-index:2147483647;background:rgba(15,23,42,0.92);backdrop-filter:blur(8px);color:#fff;border:1px solid rgba(16,185,129,0.5);padding:8px 16px;border-radius:999px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;font-weight:600;box-shadow:0 6px 20px rgba(0,0,0,0.5);display:flex;align-items:center;gap:8px;pointer-events:none;transition:all 0.3s ease;';
  if (!badge.querySelector('#ai-canvas-flow-badge-text')) {
    badge.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:#10b981;box-shadow:0 0 10px #10b981;display:inline-block;animation:pulse 2s infinite;"></span><span id="ai-canvas-flow-badge-text">AI Canvas Bridge v5.2: Đã kết nối (${isMuse ? 'Muse AI' : 'Flow'})</span>`;
  }
}

function updateBridgeBadgeText(text, bg = 'rgba(15,23,42,0.92)') {
  mountConnectionBadge();
  const badge = document.getElementById('ai-canvas-flow-badge');
  const txt = document.getElementById('ai-canvas-flow-badge-text');
  if (badge) badge.style.background = bg;
  if (txt) txt.textContent = text;
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

  // TUYỆT ĐỐI KHÔNG chọn phần tử nằm trong Sidebar phải (Muse task list) hoặc Sidebar trái
  const validElements = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 14 || r.width > 90 || r.height < 14 || r.height > 90) return false;

    // Loại trừ Sidebar phải (panel bên phải Muse AI bắt đầu từ khoảng 75-78% màn hình)
    if (r.left > window.innerWidth * 0.76) return false;
    // Loại trừ Sidebar trái (dưới 65px)
    if (r.left < 65) return false;

    // Phải nằm trong khu vực dock của promptEl (nửa dưới màn hình, gần ô nhập)
    const inPromptZone =
      r.top >= pr.top - 40 &&
      r.bottom <= Math.max(pr.bottom + 90, boxRect.bottom + 50) &&
      r.left >= pr.left + pr.width * 0.25 &&
      r.right <= Math.max(pr.right + 90, boxRect.right + 40);

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
    // Sắp xếp: Ưu tiên nút submit thật, nút có mũi tên lên / send, nút xanh dương tròn
    validElements.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();

      const isSubA = a.type === 'submit' || /send|gửi|submit|↑/i.test((a.getAttribute?.('aria-label') || '') + ' ' + (a.innerText || ''));
      const isSubB = b.type === 'submit' || /send|gửi|submit|↑/i.test((b.getAttribute?.('aria-label') || '') + ' ' + (b.innerText || ''));
      if (isSubA !== isSubB) return isSubB ? 1 : -1;

      // Gần nhất với góc dưới phải của promptEl
      const distA = Math.hypot(ra.right - pr.right, ra.bottom - pr.bottom);
      const distB = Math.hypot(rb.right - pr.right, rb.bottom - pr.bottom);
      return distA - distB;
    });

    const target = validElements[0];
    const tr = target.getBoundingClientRect();
    const btnEl = target.closest?.('button, [role="button"]') || target;
    return { el: btnEl, x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
  }

  // Fallback: Nếu không tìm thấy bằng tọa độ tương đối, tìm nút có svg mũi tên lên gần promptEl nhất
  const arrowButtons = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.left > window.innerWidth * 0.76 || r.left < 65) return false;
    if (r.top < pr.top - 50 || r.bottom > pr.bottom + 120) return false;
    return !!el.querySelector?.('svg') || (el.tagName || '').toLowerCase() === 'button';
  });

  if (arrowButtons.length > 0) {
    arrowButtons.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return Math.hypot(ra.right - pr.right, ra.bottom - pr.bottom) - Math.hypot(rb.right - pr.right, rb.bottom - pr.bottom);
    });
    const target = arrowButtons[0];
    const tr = target.getBoundingClientRect();
    const btnEl = target.closest?.('button, [role="button"]') || target;
    return { el: btnEl, x: tr.left + tr.width / 2, y: tr.top + tr.height / 2 };
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

  const hitEl = document.elementFromPoint(x, y) || el;
  const chain = [];
  let curr = hitEl;
  for (let i = 0; i < 6 && curr && curr !== document.body; i++) {
    chain.push(curr);
    curr = curr.parentElement || curr.getRootNode?.()?.host;
  }
  if (el && !chain.includes(el)) chain.push(el);

  for (const node of chain) {
    try {
      if (node.disabled) continue; // Không ép bấm vào nút đang bị disable do ảnh chưa tải xong!
      node.dispatchEvent(new PointerEvent('pointerdown', opts));
      node.dispatchEvent(new MouseEvent('mousedown', opts));
      node.dispatchEvent(new PointerEvent('pointerup', opts));
      node.dispatchEvent(new MouseEvent('mouseup', opts));
      node.dispatchEvent(new MouseEvent('click', opts));
      if (typeof node.click === 'function') node.click();
    } catch (e) {}
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

  // 2. Quét và bấm xóa toàn bộ nút xóa (✕) chip đính kèm (hỗ trợ nhiều dòng chip trên Muse AI & Google Flow)
  for (let cycle = 0; cycle < 4; cycle++) {
    const freshPrompt = findFlowPromptElement() || promptEl;
    const pr = freshPrompt ? freshPrompt.getBoundingClientRect() : null;

    const removeButtons = queryAllDeep(document).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.width > 55 || r.height < 8 || r.height > 55) return false;

      // Mở rộng vùng tìm kiếm lên đến 550px phía trên prompt để bao trùm tất cả các hàng chip ảnh
      if (pr) {
        const nearPrompt =
          r.left >= pr.left - 160 &&
          r.right <= pr.right + 160 &&
          r.top >= pr.top - 550 &&
          r.bottom <= pr.bottom + 80;
        if (!nearPrompt) return false;
      }

      const tag = (el.tagName || '').toLowerCase();
      const isClickable =
        tag === 'button' ||
        el.getAttribute?.('role') === 'button' ||
        window.getComputedStyle(el).cursor === 'pointer';
      if (!isClickable) return false;

      const label = (
        (el.getAttribute?.('aria-label') || '') +
        ' ' +
        (el.getAttribute?.('title') || '') +
        ' ' +
        (el.innerText || el.textContent || '')
      ).toLowerCase();

      if (/expand|fullscreen|open_in_full|mở rộng|phóng to|maximize/i.test(label)) return false;

      const hasSvgIcon = Boolean(el.querySelector?.('svg') || tag === 'svg');
      const matchesText = /remove|xóa|delete|close|dismiss|clear|huỷ|hủy/i.test(label) || label.trim() === '✕' || label.trim() === '×';

      // Nút xóa chip trên Muse AI thường là nút tròn nhỏ có icon SVG cross (✕)
      return matchesText || hasSvgIcon;
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
      await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          {
            type: 'NATIVE_CLICK_AND_ENTER',
            x: pr.left + pr.width * 0.5,
            y: pr.top + pr.height * 0.5,
            clickOnly: true
          },
          () => resolve()
        );
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

function isFingerprintMatch(fp1, fp2, threshold = 22) {
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

  for (let attempt = 1; attempt <= 3; attempt++) {
    promptEl = findFlowPromptElement() || promptEl;
    const remainingBefore = (promptEl.innerText || promptEl.value || promptEl.textContent || '').trim();
    if (attempt > 1 && remainingBefore.length < 5) {
      break;
    }

    const currentTarget = findFlowSubmitTarget(promptEl) || targetInfo;
    if (currentTarget && currentTarget.el && !currentTarget.el.disabled) {
      updateBridgeBadgeText(`v5.1: Bấm nút Gửi (${isMuse ? '↑ Muse AI' : '➔ Flow'}) [Lần ${attempt}]...`, '#e11d48');
      triggerDOMClickAt(currentTarget);

      await new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage(
            {
              type: 'NATIVE_CLICK_AND_ENTER',
              x: currentTarget.x,
              y: currentTarget.y,
              clickOnly: false
            },
            (res) => resolve(res)
          );
        } catch (e) {
          resolve(null);
        }
      });

      // Dispatch thêm sự kiện phím Enter trực tiếp vào promptEl
      try {
        promptEl.focus();
        promptEl.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
        promptEl.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
        promptEl.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 }));
      } catch (e) {}
    }

    await new Promise((r) => setTimeout(r, 800));

    const freshPromptEl = findFlowPromptElement() || promptEl;
    const remainingAfter = (freshPromptEl.innerText || freshPromptEl.value || freshPromptEl.textContent || '').trim();
    if (remainingAfter.length < 5) {
      break;
    }
  }

  updateBridgeBadgeText(`🚀 v5.1: Đã gửi lệnh! Đang đợi kết quả từ ${isMuse ? 'Muse AI' : 'Google Flow'}...`, '#7c3aed');
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

  // 1. Kiểm tra các thẻ cha có class hoặc thuộc tính liên quan đến Chip/Attachment/Upload/Preview
  let curr = el;
  for (let i = 0; i < 6 && curr && curr !== document.body; i++) {
    const cls = (curr.className || '').toString().toLowerCase();
    const role = (curr.getAttribute?.('role') || '').toLowerCase();
    const testid = (curr.getAttribute?.('data-testid') || '').toLowerCase();
    const aria = (curr.getAttribute?.('aria-label') || '').toLowerCase();

    if (
      cls.includes('chip') ||
      cls.includes('attachment') ||
      cls.includes('thumbnail') ||
      cls.includes('preview') ||
      cls.includes('upload') ||
      role === 'status' ||
      testid.includes('attachment') ||
      testid.includes('chip') ||
      aria.includes('đính kèm') ||
      aria.includes('attachment') ||
      aria.includes('xóa') ||
      aria.includes('remove')
    ) {
      return true;
    }
    if (curr.querySelector?.('button[aria-label*="Remove"], button[aria-label*="Xóa"], [data-testid*="remove"]')) {
      return true;
    }
    curr = curr.parentElement;
  }

  // 2. Nằm trong vùng thanh nhập Prompt ở đáy màn hình
  if (promptEl) {
    const pr = promptEl.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    if (
      r.top >= pr.top - 220 &&
      r.bottom <= pr.bottom + 120 &&
      r.left >= pr.left - 80 &&
      r.right <= pr.right + 100
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
    if (!el.complete) return false;
    const nw = el.naturalWidth || 0;
    const nh = el.naturalHeight || 0;
    const minNatural = isMuse ? (mode === 'VIDEO' ? 80 : 160) : 480;
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
  try {
    const escDown = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
    const escUp = new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
    document.dispatchEvent(escDown);
    document.dispatchEvent(escUp);
    if (document.body) {
      document.body.dispatchEvent(escDown);
      document.body.dispatchEvent(escUp);
    }
  } catch (e) {}

  const allElements = queryAllDeep(document);

  // 1. Quét tìm cụ thể các modal task / log chi tiết trên Muse AI ("Tạo video AI", "Tóm tắt", "Hoàn tất")
  const taskModals = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 250 || r.height < 180) return false;
    const txt = ((el.innerText || el.textContent || '')).slice(0, 800).toLowerCase();
    const isModalType =
      el.getAttribute?.('role') === 'dialog' ||
      el.getAttribute?.('aria-modal') === 'true' ||
      (el.className && String(el.className).toLowerCase().includes('modal')) ||
      (r.left > window.innerWidth * 0.15 && r.right < window.innerWidth * 0.95 && r.top > 20);

    return isModalType && (txt.includes('tạo video ai') || txt.includes('tóm tắt') || txt.includes('hoàn tất') || txt.includes('no video was actually created'));
  });

  for (const modal of taskModals) {
    const mr = modal.getBoundingClientRect();
    // Tìm nút tròn ✕ ở góc trên bên phải của modal
    const closeCandidates = queryAllDeep(modal).filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.width > 70 || r.height < 12 || r.height > 70) return false;
      const isTopRight = r.top >= mr.top - 15 && r.top <= mr.top + 100 && r.right >= mr.right - 100 && r.right <= mr.right + 25;
      const label = ((el.getAttribute?.('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.innerText || '')).toLowerCase();
      const hasCloseTxt = /close|đóng|dismiss|x/i.test(label) || label.includes('✕') || label.includes('×');
      const hasSvg = !!el.querySelector?.('svg') || (el.tagName || '').toLowerCase() === 'svg';
      return isTopRight && (hasCloseTxt || hasSvg);
    });

    for (const btn of closeCandidates) {
      try {
        btn.click();
        const r = btn.getBoundingClientRect();
        triggerDOMClickAt({ el: btn, x: r.left + r.width / 2, y: r.top + r.height / 2 });
      } catch (e) {}
    }

    // Ẩn cưỡng bức modal để không bao giờ hiện đè lên giao diện
    try {
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('opacity', '0', 'important');
      modal.style.setProperty('pointer-events', 'none', 'important');
    } catch (e) {}
  }

  // 2. Quét chung mọi nút close/dismiss khác trên màn hình
  const genericCloseButtons = allElements.filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 12 || r.width > 65 || r.height < 12 || r.height > 65) return false;
    if (r.top > window.innerHeight * 0.45) return false; // Nằm ở nửa trên màn hình
    const label = ((el.getAttribute?.('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.innerText || '')).toLowerCase();
    if (/close|đóng|dismiss/i.test(label) || label.trim() === '✕' || label.trim() === '×' || label.trim() === 'x') {
      return true;
    }
    const hasSvg = !!el.querySelector?.('svg');
    return hasSvg && r.left > window.innerWidth * 0.4 && r.left < window.innerWidth * 0.78;
  });

  for (const btn of genericCloseButtons) {
    try {
      btn.click();
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

function captureNewMediaOutput(
  existingSet,
  inputFingerprints = [],
  initialFailCount = 0,
  mode = 'IMAGE',
  timeoutMs = 120000,
  submitTimestamp = Date.now()
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
    // BẮT BUỘC: Video trên Muse AI cần tối thiểu 20s để sinh (không bao giờ xong trong 8s)
    // Ảnh trên Muse AI cần tối thiểu 8s để sinh
    const MIN_WAIT_MS = isMuse ? (mode === 'VIDEO' ? 20000 : 8000) : (mode === 'VIDEO' ? 15000 : 5000);

    const cleanup = () => {
      isResolved = true;
      clearTimeout(timer);
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
      if (Date.now() - lastApproveClickAt < 2500) return;
      const allClickable = queryAllDeep(document).filter((el) => {
        const tag = (el.tagName || '').toLowerCase();
        return tag === 'button' || el.getAttribute?.('role') === 'button' || tag.includes('button');
      });

      const approveBtn =
        allClickable.find((el) => /luôn phê duyệt|always approve/i.test((el.innerText || el.textContent || '').trim())) ||
        allClickable.find((el) => /^(\s*✓?\s*)?(phê duyệt|approve|xác nhận|confirm)$/i.test((el.innerText || el.textContent || '').trim()));

      if (approveBtn) {
        const r = approveBtn.getBoundingClientRect();
        if (r.width > 20 && r.height > 16) {
          lastApproveClickAt = Date.now();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          updateBridgeBadgeText('⚡ v5.1: Tự động bấm "Phê duyệt"...', '#f59e0b');
          triggerDOMClickAt({ el: approveBtn, x: cx, y: cy });
          try {
            chrome.runtime.sendMessage({ type: 'NATIVE_CLICK_AND_ENTER', x: cx, y: cy, clickOnly: true });
          } catch (e) {}
        }
      }
    };

    let isChecking = false;
    let hasAutoConfirmedMuse = false;

    const checkMedia = async () => {
      if (isResolved || isChecking) return;
      isChecking = true;
      try {
        if (isMuse) dismissAnyOpenModal();
        checkAutoApproveButtons();

        // 1. Kiểm tra thời gian tối thiểu kể từ khi bấm Gửi
        const elapsed = Date.now() - submitTimestamp;
        if (elapsed < MIN_WAIT_MS) {
          updateBridgeBadgeText(
            `⏳ ${isMuse ? 'Muse AI' : 'Google Flow'} đang xử lý... (${Math.max(1, Math.round((MIN_WAIT_MS - elapsed) / 1000))}s)`,
            '#e11d48'
          );
          return;
        }

        // TỰ ĐỘNG THÚC ĐẨY (Auto-Nudge) NẾU MUSE AI DỪNG LẠI Ở BƯỚC "SẴN SÀNG":
        const bodyText = (document.body.innerText || '') + ' ' + (document.body.textContent || '');
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

          // Đóng popup task log nếu có nút ✕
          const modalCloseBtns = queryAllDeep(document).filter((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 14 || r.width > 55 || r.height < 14 || r.height > 55) return false;
            if (r.top > window.innerHeight * 0.40) return false; // Nằm ở góc trên modal
            const label = ((el.getAttribute?.('aria-label') || '') + ' ' + (el.innerText || '')).toLowerCase();
            return /close|đóng|x/i.test(label) || label.includes('✕') || label.includes('×') || !!el.querySelector?.('svg');
          });
          if (modalCloseBtns.length > 0) {
            try { modalCloseBtns[0].click(); } catch (e) {}
            await new Promise((r) => setTimeout(r, 400));
          }

          const promptTarget = findFlowPromptElement();
          if (promptTarget) {
            const confirmTxt = mode === 'VIDEO' ? 'Yes, create and generate the video now! Execute media tool immediately.' : 'Yes, generate the image now!';
            await typePromptTextIntoElement(promptTarget, confirmTxt);
            await new Promise((r) => setTimeout(r, 400));
            const btnTarget = findMuseSubmitTarget(promptTarget);
            if (btnTarget) {
              triggerDOMClickAt(btnTarget);
              try {
                chrome.runtime.sendMessage({
                  type: 'NATIVE_CLICK_AND_ENTER',
                  x: btnTarget.x,
                  y: btnTarget.y,
                  clickOnly: false
                });
              } catch (e) {}
            }
          }
        }

        // 2. Phát hiện trạng thái Muse AI đang sinh (Progress bar, spinner, Generating, Thinking, hoặc nút Stop)
        const progressEls = queryAllDeep(document).filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 10 || r.height < 2) return false;
          const role = el.getAttribute?.('role') || '';
          const cls = (el.className || '').toString().toLowerCase();
          const aria = (el.getAttribute?.('aria-label') || '').toLowerCase();
          return (
            role === 'progressbar' ||
            cls.includes('progress') ||
            cls.includes('spinner') ||
            cls.includes('loading') ||
            aria.includes('đang tạo') ||
            aria.includes('generating')
          );
        });

        // Kiểm tra xem Muse AI có nút Dừng (Stop / Cancel) hoặc chữ Thinking/Generating không
        const isMuseBusy = isMuse && (() => {
          const bodyTxt = (document.body.innerText || '').toLowerCase();
          const hasStopBtn = queryAllDeep(document).some((el) => {
            const r = el.getBoundingClientRect();
            if (r.top < window.innerHeight * 0.5) return false;
            const lbl = ((el.getAttribute?.('aria-label') || '') + ' ' + (el.title || '') + ' ' + (el.innerText || '')).toLowerCase();
            return /stop|dừng|cancel/i.test(lbl) || lbl.includes('⏹');
          });
          if (hasStopBtn) return true;

          return (
            bodyTxt.includes('thinking...') ||
            bodyTxt.includes('đang suy nghĩ') ||
            bodyTxt.includes('generating...') ||
            bodyTxt.includes('rendering...') ||
            bodyTxt.includes('executing media')
          );
        })();

        if (progressEls.length > 0 || isMuseBusy) {
          updateBridgeBadgeText(
            `⚡ ${isMuse ? 'Muse AI' : 'Google Flow'} đang thực thi sinh ${mode === 'VIDEO' ? 'Video' : 'Ảnh'}... (${Math.round(elapsed / 1000)}s)`,
            '#f59e0b'
          );
          return; // Đang chạy, chưa xong!
        }

        scrollFlowGalleryToTop();
        const promptEl = findFlowPromptElement();
        // Luôn quét cả thẻ VIDEO lẫn IMG (vì trên Muse AI video hoàn tất thường đi kèm thumbnail poster hoặc player)
        const allNodes = queryAllDeep(document).filter((el) => {
          return el.tagName === 'IMG' || el.tagName === 'VIDEO';
        });

        // Ưu tiên thẻ VIDEO trước nếu mode === 'VIDEO', sau đó đến IMG
        allNodes.sort((a, b) => {
          if (mode === 'VIDEO') {
            if (a.tagName === 'VIDEO' && b.tagName !== 'VIDEO') return -1;
            if (b.tagName === 'VIDEO' && a.tagName !== 'VIDEO') return 1;
          }
          const ra = a.getBoundingClientRect();
          const rb = b.getBoundingClientRect();
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

          // Nếu ở mode VIDEO: Bắt buộc đã trôi qua ít nhất 18s
          if (mode === 'VIDEO' && elapsed < 18000) {
            updateBridgeBadgeText(`⏳ Đang đợi Muse AI render xong Video 9:16... (${Math.round(elapsed / 1000)}s / 20s)`, '#3b82f6');
            return;
          }

          // Chỉ so khớp fingerprint loại trừ ảnh đầu vào khi ở mode IMAGE
          // (Khi ở mode VIDEO: poster video tạo ra bắt buộc phải giống người mẫu trong ảnh đầu vào, không được loại trừ!)
          if (mode === 'IMAGE' && el.tagName === 'IMG' && Array.isArray(inputFingerprints) && inputFingerprints.length > 0) {
            const candFp = computeImageFingerprintFromElement(el);
            if (candFp) {
              const matchesInput = inputFingerprints.some((inFp) => inFp && isFingerprintMatch(candFp, inFp));
              if (matchesInput) {
                console.warn('⚠️ [FlowContent] Bỏ qua vì trùng vân tay ảnh đầu vào:', src.slice(0, 80));
                continue;
              }
            }
          }

          // Ở mode VIDEO: Ưu tiên tìm link video .mp4 thực sự từ thẻ video hoặc link tải lân cận nếu có
          let finalMediaSrc = src;
          if (mode === 'VIDEO') {
            const cardParent = el.closest?.('div, article, section, [class*="message"], [class*="card"]');
            if (cardParent) {
              const videoTag = cardParent.querySelector?.('video, source');
              const mp4Link = cardParent.querySelector?.('a[href*=".mp4"], a[download*=".mp4"], a[href*="video"]');
              if (videoTag && (videoTag.currentSrc || videoTag.src)) {
                finalMediaSrc = videoTag.currentSrc || videoTag.src;
              } else if (mp4Link && (mp4Link.href || mp4Link.getAttribute('href'))) {
                finalMediaSrc = mp4Link.href || mp4Link.getAttribute('href');
              }
            }
          }

          existingSet.add(src);
          existingSet.add(finalMediaSrc);
          cleanup();

          updateBridgeBadgeText(`✅ v5.4: Bắt được kết quả ${mode === 'VIDEO' ? 'Video' : 'Ảnh'} từ ${isMuse ? 'Muse AI' : 'Google Flow'}! Đang đồng bộ về bàn vẽ...`, '#10b981');
          const base64Data = await convertFlowUrlToBase64(finalMediaSrc, el);
          resolve({ rawUrl: finalMediaSrc, base64Data: base64Data || finalMediaSrc });
          return;
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
        }
      } catch (err) {
        console.warn(`⚠️ [FlowContent v5.1] Lỗi khi quét Media mới:`, err);
      } finally {
        isChecking = false;
      }
    };

    const observer = new MutationObserver(() => checkMedia());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src']
    });
    const pollInterval = setInterval(checkMedia, 600);
  });
}

window.__AI_CANVAS_RUN_FLOW_TASK__ = async function (payload = {}) {
  const { mode = 'IMAGE', images = [], prompt = '' } = payload;
  const isMuse = window.location.hostname.includes('muse.ai');

  // Đợi 1 giây để giao diện Muse AI ổn định trước khi nhận lượt mới
  if (isMuse) {
    dismissAnyOpenModal();
    await new Promise((r) => setTimeout(r, 1000));
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

  const timeoutMs = mode === 'VIDEO' ? 240000 : 120000;
  const output = await captureNewMediaOutput(
    existingUrls,
    inputFingerprints,
    initialFailCount,
    mode,
    timeoutMs,
    submitTimestamp
  );
  updateBridgeBadgeText(`✅ v5.3: Đã nhận kết quả thành công từ ${isMuse ? 'Muse AI' : 'Google Flow'}!`, 'rgba(16,185,129,0.95)');
  return {
    ok: true,
    mode,
    rawUrl: output.rawUrl,
    base64: output.base64Data
  };
};

window.__AI_CANVAS_MESSAGE_DISPATCHER__ = (message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'PING_CHECK') {
    sendResponse({ ok: true, version: '4.1.0' });
    return false;
  }

  if (message.type === 'CANCEL_ACTIVE_FLOW_TASK') {
    if (typeof window.__AI_CANVAS_CANCEL_CURRENT_TASK__ === 'function') {
      try {
        window.__AI_CANVAS_CANCEL_CURRENT_TASK__();
      } catch (e) {}
    }
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
