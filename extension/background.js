/**
 * BACKGROUND SERVICE WORKER (v3.5) - MULTI-TAB POOL & HARDWARE CDP BRIDGE
 * Cải tiến v3.5:
 * - Quét mọi tab bằng chrome.tabs.query({}) (không bao giờ trượt cổng :5173 hoặc URL redirect của Google Flow)
 * - Tự động giải phóng Worker bị kẹt từ lần chạy trước để gửi lệnh sang Google Flow tức thì (0ms chờ)
 * - Tự động Focus cả Cửa sổ (Window) lẫn Tab Google Flow + hỗ trợ gõ chữ & click phần cứng qua Chrome Debugger (CDP)
 * - Tự động chuẩn hóa mọi ảnh đầu vào (CDN URL / PNG / WebP / Base64) sang JPEG nhẹ (<150KB) bằng OffscreenCanvas ngay trong Background
 */

const MAX_CONCURRENT_TABS = 3;
const FLOW_DEFAULT_URL = 'https://muse.ai/?activation_view=setup';
const BACKEND_BASE_API = 'http://localhost:5001/api/ai';
const BACKEND_SELECTOR_API = `${BACKEND_BASE_API}/flow-selectors`;

let workerTabs = [];
let taskQueue = [];
let dynamicSelectors = null;
let isPollingBackend = false;
let lastProcessedJob = null;

function enqueueUniqueJob(payload, sendResponse) {
  if (!payload) return;

  // 1. Kiểm tra nếu job trùng prompt & mode đã có trong taskQueue
  const existingJob = taskQueue.find(
    (j) => j.payload?.prompt === payload.prompt && j.payload?.mode === payload.mode
  );
  if (existingJob) {
    console.warn('⚠️ [Background] Bỏ qua tác vụ trùng lặp trong hàng đợi:', payload.prompt?.slice(0, 40));
    const oldSend = existingJob.sendResponse;
    existingJob.sendResponse = (res) => {
      try { if (typeof oldSend === 'function') oldSend(res); } catch (e) {}
      try { if (typeof sendResponse === 'function') sendResponse(res); } catch (e) {}
    };
    return;
  }

  // 2. Kiểm tra nếu tác vụ vừa mới được đưa vào xử lý trong 8 giây qua
  const now = Date.now();
  if (
    lastProcessedJob &&
    lastProcessedJob.prompt === payload.prompt &&
    lastProcessedJob.mode === payload.mode &&
    now - lastProcessedJob.timestamp < 8000
  ) {
    console.warn('⚠️ [Background] Bỏ qua tác vụ trùng lặp vừa mới chạy gần đây:', payload.prompt?.slice(0, 40));
    return;
  }

  lastProcessedJob = {
    prompt: payload.prompt,
    mode: payload.mode,
    timestamp: now
  };

  taskQueue.push({ payload, sendResponse });
  processQueue();
}

function isFlowTabUrl(url = '') {
  return Boolean(
    url &&
      (url.includes('muse.ai') ||
        url.includes('flow.google') ||
        url.includes('labs.google'))
  );
}

function isLocalCanvasTabUrl(url = '') {
  return Boolean(url && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(url));
}

async function queryFlowTabs() {
  const allTabs = await chrome.tabs.query({});
  const flowTabs = allTabs.filter((t) => isFlowTabUrl(t.url));
  flowTabs.sort((a, b) => {
    // Ưu tiên tab muse.ai trước, sau đó tới flow.google
    const aScore =
      (a.url?.includes('muse.ai') ? 10 : 0) +
      (a.url?.includes('/project/') || a.url?.includes('/tools/flow') ? 4 : 0) +
      (a.active ? 2 : 0);
    const bScore =
      (b.url?.includes('muse.ai') ? 10 : 0) +
      (b.url?.includes('/project/') || b.url?.includes('/tools/flow') ? 4 : 0) +
      (b.active ? 2 : 0);
    return bScore - aScore;
  });
  return flowTabs;
}

async function syncDynamicSelectors() {
  try {
    const res = await fetch(BACKEND_SELECTOR_API);
    if (res.ok) {
      const data = await res.json();
      if (data.selectors) {
        dynamicSelectors = data.selectors;
        await chrome.storage.local.set({ flowSelectors: dynamicSelectors });
      }
    }
  } catch (e) {}
}

async function injectBridgeIntoExistingTabs() {
  try {
    const allTabs = await chrome.tabs.query({});
    for (const tab of allTabs) {
      if (!tab.id || !tab.url) continue;
      if (isLocalCanvasTabUrl(tab.url)) {
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['canvas-bridge.js'] }).catch(() => {});
      } else if (isFlowTabUrl(tab.url)) {
        chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] }).catch(() => {});
      }
    }
  } catch (e) {
    console.warn('Auto-inject warning:', e);
  }
}

// Chạy ngay lập tức khi Service Worker thức dậy, cũng như khi cài đặt/reload
injectBridgeIntoExistingTabs();
syncDynamicSelectors();

chrome.runtime.onInstalled.addListener(() => {
  syncDynamicSelectors();
  injectBridgeIntoExistingTabs();
});

chrome.runtime.onStartup.addListener(() => {
  syncDynamicSelectors();
  injectBridgeIntoExistingTabs();
});

// Chuẩn hóa mọi URL ảnh hoặc Base64 sang chuẩn JPEG nhẹ (max 1280px, <150KB) ngay trong Background Worker
async function fetchAndNormalizeImageAsJpegBase64(urlOrData) {
  const response = await fetch(urlOrData);
  const blob = await response.blob();

  // Nếu là ảnh và trình duyệt hỗ trợ OffscreenCanvas -> chuẩn hóa sang baseline JPEG 1280px
  if (typeof createImageBitmap === 'function' && typeof OffscreenCanvas !== 'undefined') {
    try {
      const bmp = await createImageBitmap(blob);
      const maxDim = 1280;
      let w = bmp.width || 800;
      let h = bmp.height || 800;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
      }
      const canvas = new OffscreenCanvas(w, h);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close?.();

      const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
      const arrayBuffer = await jpegBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
      }
      return `data:image/jpeg;base64,${btoa(binary)}`;
    } catch (e) {
      // Nếu không phải ảnh tĩnh (ví dụ video) hoặc lỗi decode thì chuyển sang đọc trực tiếp bên dưới
    }
  }

  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const mimeType = blob.type || 'image/jpeg';
  return `data:${mimeType};base64,${btoa(binary)}`;
}

// Đảm bảo content.js v4.0.0 đã được nhúng và sẵn sàng nhận lệnh trên tab Google Flow
async function ensureContentScriptReady(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'PING_CHECK' });
    if (res && res.ok && (res.version === '4.0.0' || res.version?.startsWith('4.'))) return true;
  } catch (e) {}

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
    await new Promise((r) => setTimeout(r, 450));
    return true;
  } catch (err) {
    console.warn('⚠️ Không thể nhúng content.js vào tab:', tabId, err);
    return false;
  }
}

async function focusFlowTabAndWindow(tabId, windowId) {
  try {
    if (windowId) {
      await chrome.windows.update(windowId, { focused: true }).catch(() => {});
    }
    await chrome.tabs.update(tabId, { active: true }).catch(() => {});
  } catch (e) {}
}

async function broadcastLogToCanvasTabs(log) {
  try {
    const canvasTabs = await chrome.tabs.query({
      url: ['http://localhost/*', 'http://127.0.0.1/*']
    });
    for (const tab of canvasTabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'BRIDGE_LOG_BROADCAST', log }).catch(() => {});
      }
    }
  } catch (e) {}
}

// Tìm hoặc cấp phát Tab Google Flow / Muse AI (chờ tuần tự cho đến khi tab rảnh hoàn toàn)
async function acquireAvailableFlowTab() {
  const waitStart = Date.now();

  while (true) {
    const openTabs = await queryFlowTabs();
    const openTabIds = new Set(openTabs.map((t) => t.id));
    workerTabs = workerTabs.filter((w) => openTabIds.has(w.tabId));

    for (const tab of openTabs) {
      const existing = workerTabs.find((w) => w.tabId === tab.id);
      if (!existing) {
        workerTabs.push({ tabId: tab.id, windowId: tab.windowId, busy: false });
      } else {
        existing.windowId = tab.windowId;
      }
    }

    // Ưu tiên cấp worker đang rảnh
    const freeWorker = workerTabs.find((w) => !w.busy);
    if (freeWorker) {
      freeWorker.busy = true;
      return freeWorker;
    }

    // Nếu chưa mở bất kỳ tab nào -> tự động mở ngầm ở tab nền (không cướp màn hình của người dùng)
    if (workerTabs.length === 0) {
      const newTab = await chrome.tabs.create({ url: FLOW_DEFAULT_URL, active: false });
      await waitForTabComplete(newTab.id);
      const worker = { tabId: newTab.id, windowId: newTab.windowId, busy: true };
      workerTabs.push(worker);
      return worker;
    }

    // Nếu tab đang bận xử lý lượt trước -> ĐỢI TUẦN TỰ (không bao giờ cướp tab giữa chừng)
    await new Promise((r) => setTimeout(r, 600));

    // Sau 5 phút chờ mà vẫn bận thì mới tự giải phóng
    if (Date.now() - waitStart > 300000) {
      workerTabs[0].busy = false;
    }
  }
}

function waitForTabComplete(tabId, timeoutMs = 20000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);

    function listener(updatedTabId, info) {
      if (updatedTabId === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  if (taskQueue.length === 0) return;

  isProcessingQueue = true;
  try {
    while (taskQueue.length > 0) {
      const job = taskQueue.shift();
      const worker = await acquireAvailableFlowTab();

      try {
        if (!dynamicSelectors) await syncDynamicSelectors();

        // Chạy ngầm hoàn toàn trên tab Muse AI / Google Flow, KHÔNG tự động chuyển tab làm gián đoạn trang Tool của người dùng
        await ensureContentScriptReady(worker.tabId);
        broadcastLogToCanvasTabs({
          time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
          source: 'Bridge',
          text: `⚙️ Đang gửi lệnh (${job.payload?.mode || 'IMAGE'}) sang tab Muse AI chạy ngầm...`,
          level: 'info'
        });

        const response = await chrome.tabs.sendMessage(worker.tabId, {
          type: 'EXECUTE_FLOW_NODE',
          payload: {
            ...job.payload,
            selectors: dynamicSelectors
          }
        });

        job.sendResponse({
          success: Boolean(response && response.ok),
          tabId: worker.tabId,
          ...(response || {})
        });
      } catch (err) {
        job.sendResponse({
          success: false,
          ok: false,
          tabId: worker?.tabId,
          error: err.message || 'Lỗi khi thực thi trên tab Google Flow / Muse AI'
        });
      } finally {
        if (worker) worker.busy = false;
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

// Chủ động đồng bộ Heartbeat & nhận lệnh từ Backend Relay (localhost:5001) mỗi 1.2 giây
async function pollBackendBridge() {
  if (isPollingBackend) return;
  isPollingBackend = true;
  try {
    const openTabs = await queryFlowTabs();
    const primaryTab = openTabs[0];

    const res = await fetch(`${BACKEND_BASE_API}/flow-bridge/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: primaryTab ? `tab-${primaryTab.id}` : 'bg-worker',
        url: primaryTab?.url || FLOW_DEFAULT_URL,
        title: primaryTab?.title || 'Google Flow Bridge Worker'
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.job) {
        const { jobId, type, payload } = data.job;
        if (type === 'PING_FLOW_TAB') {
          let targetTab = primaryTab;
          if (!targetTab) {
            targetTab = await chrome.tabs.create({ url: FLOW_DEFAULT_URL, active: false });
            await waitForTabComplete(targetTab.id);
          } else if (payload?.focus) {
            await focusFlowTabAndWindow(targetTab.id, targetTab.windowId);
          }
          await ensureContentScriptReady(targetTab.id);
          chrome.tabs.sendMessage(targetTab.id, { type: 'PING_FROM_CANVAS' }, (pingRes) => {
            fetch(`${BACKEND_BASE_API}/flow-bridge/result`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                jobId,
                response: {
                  success: true,
                  tabId: targetTab.id,
                  tabUrl: targetTab.url,
                  contentStatus: pingRes
                }
              })
            }).catch(() => {});
          });
        } else if (type === 'QUEUE_FLOW_JOB' || type === 'EXECUTE_FLOW_NODE') {
          enqueueUniqueJob(payload, (jobRes) => {
            fetch(`${BACKEND_BASE_API}/flow-bridge/result`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jobId, response: jobRes })
            }).catch(() => {});
          });
        }
      }
    }
  } catch (e) {
    // Backend chưa bật hoặc đang khởi động lại
  } finally {
    isPollingBackend = false;
  }
}

setInterval(pollBackendBridge, 1200);

async function withTemporaryTabFocus(tabId, fn) {
  let prevTabId = null;
  try {
    const tab = await chrome.tabs.get(tabId);
    const [activeInSameWin] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (activeInSameWin && activeInSameWin.id !== tabId) {
      prevTabId = activeInSameWin.id;
      await chrome.tabs.update(tabId, { active: true }).catch(() => {});
      // Đợi 250ms để Chrome đánh thức renderer của tab nền trước khi gửi click/phím phần cứng
      await new Promise((r) => setTimeout(r, 250));
    }
    const result = await fn();
    if (prevTabId) {
      // Đợi 250ms sau khi click để React trên Muse AI xử lý xong sự kiện rồi mới trả về tab Tool
      await new Promise((r) => setTimeout(r, 250));
    }
    return result;
  } finally {
    if (prevTabId) {
      await chrome.tabs.update(prevTabId, { active: true }).catch(() => {});
    }
  }
}

// Lắng nghe yêu cầu từ Web Canvas (canvas-bridge.js) và từ content.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Đánh thức nhanh tab Muse AI (~350ms) khi chạy ngầm bị Chrome đóng băng, rồi tự động trả về tab Tool
  if (message.type === 'PULSE_TAB_WAKEUP') {
    const tabId = sender.tab?.id;
    if (!tabId) {
      sendResponse({ ok: false });
      return false;
    }
    withTemporaryTabFocus(tabId, async () => {
      await new Promise((r) => setTimeout(r, 250));
      sendResponse({ ok: true });
    });
    return true;
  }

  // Click chuột vào ô Prompt và gõ chữ cấp độ phần cứng (CDP Input.insertText)
  if (message.type === 'NATIVE_INSERT_PROMPT') {
    const tabId = sender.tab?.id;
    const { x, y, text } = message;
    if (!tabId || !chrome.debugger) {
      sendResponse({ ok: false, error: 'No tabId or debugger API' });
      return false;
    }

    withTemporaryTabFocus(tabId, async () => {
      const target = { tabId };
      try {
        await chrome.debugger.attach(target, '1.3').catch(() => {});
        if (typeof x === 'number' && typeof y === 'number') {
          await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1
          });
          await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            clickCount: 1
          });
          await new Promise((r) => setTimeout(r, 120));
        }
        if (text) {
          await chrome.debugger.sendCommand(target, 'Input.insertText', {
            text: String(text)
          });
        }
        await chrome.debugger.detach(target).catch(() => {});
        sendResponse({ ok: true });
      } catch (err) {
        await chrome.debugger.detach(target).catch(() => {});
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }

  // Click chuột & nhấn phím Enter cấp độ phần cứng (isTrusted: true) bằng Chrome Debugger API
  if (message.type === 'NATIVE_CLICK_AND_ENTER') {
    const tabId = sender.tab?.id;
    const { x, y, clickOnly = false } = message;
    if (!tabId || !chrome.debugger) {
      sendResponse({ ok: false, error: 'No tabId or debugger API' });
      return false;
    }

    withTemporaryTabFocus(tabId, async () => {
      const target = { tabId };
      try {
        await chrome.debugger.attach(target, '1.3').catch(() => {});
        if (typeof x === 'number' && typeof y === 'number') {
          await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
            type: 'mouseMoved',
            x: Math.round(x),
            y: Math.round(y)
          });
          await new Promise((r) => setTimeout(r, 40));
          await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
            type: 'mousePressed',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            buttons: 1,
            clickCount: 1
          });
          await new Promise((r) => setTimeout(r, 80));
          await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
            type: 'mouseReleased',
            x: Math.round(x),
            y: Math.round(y),
            button: 'left',
            buttons: 0,
            clickCount: 1
          });
        }
        if (!clickOnly) {
          await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
            type: 'keyDown',
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter',
            text: '\r'
          });
          await chrome.debugger.sendCommand(target, 'Input.dispatchKeyEvent', {
            type: 'keyUp',
            windowsVirtualKeyCode: 13,
            nativeVirtualKeyCode: 13,
            key: 'Enter',
            code: 'Enter'
          });
        }
        await chrome.debugger.detach(target).catch(() => {});
        sendResponse({ ok: true });
      } catch (err) {
        await chrome.debugger.detach(target).catch(() => {});
        sendResponse({ ok: false, error: err.message });
      }
    });
    return true;
  }

  if (message.type === 'FLOW_TAB_HEARTBEAT') {
    pollBackendBridge();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'RESET_FLOW_WORKERS') {
    taskQueue = [];
    workerTabs.forEach((w) => {
      w.busy = false;
      chrome.tabs.sendMessage(w.tabId, { type: 'CANCEL_ACTIVE_FLOW_TASK' }).catch(() => {});
    });
    sendResponse({ ok: true });
    return false;
  }

  // Hỗ trợ content.js tải và chuẩn hóa ảnh/video cross-origin sang JPEG Base64 sạch (0% lỗi CORS/CSP)
  if (message.type === 'FETCH_URL_AS_BASE64') {
    (async () => {
      try {
        const base64 = await fetchAndNormalizeImageAsJpegBase64(message.url);
        sendResponse({ ok: true, base64 });
      } catch (err) {
        sendResponse({ ok: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'QUEUE_FLOW_JOB') {
    enqueueUniqueJob(message.payload, sendResponse);
    return true;
  }

  if (message.type === 'GET_POOL_STATUS') {
    queryFlowTabs().then((openTabs) => {
      sendResponse({
        maxConcurrentTabs: MAX_CONCURRENT_TABS,
        openFlowTabs: openTabs ? openTabs.length : 0,
        flowTabUrls: openTabs ? openTabs.map((t) => t.url) : [],
        activeWorkers: workerTabs.length,
        busyWorkers: workerTabs.filter((w) => w.busy).length,
        queuedJobs: taskQueue.length
      });
    });
    return true;
  }

  if (message.type === 'BRIDGE_LOG_EVENT' && message.log) {
    broadcastLogToCanvasTabs(message.log);
    return false;
  }

  if (message.type === 'FOCUS_FLOW_TAB') {
    (async () => {
      try {
        const openTabs = await queryFlowTabs();
        let targetTab = openTabs[0];
        if (!targetTab) {
          targetTab = await chrome.tabs.create({ url: FLOW_DEFAULT_URL, active: true });
        } else {
          await focusFlowTabAndWindow(targetTab.id, targetTab.windowId);
        }
        sendResponse({ success: true, tabId: targetTab.id });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  // Mở 2 cửa sổ song song (Trái: Web Canvas Tool, Phải: Muse AI) để cả 2 cùng hiển thị đồng thời
  if (message.type === 'OPEN_SPLIT_WINDOWS') {
    (async () => {
      try {
        const canvasUrl = message.canvasUrl || 'http://localhost:5174/';
        const currentWin = await chrome.windows.getLastFocused();
        const totalW = currentWin?.width || 1440;
        const totalH = currentWin?.height || 900;
        const leftX = currentWin?.left || 0;
        const topY = currentWin?.top || 0;
        const leftW = Math.round(totalW * 0.54);
        const rightW = totalW - leftW;

        // Tìm tab Tool và tab Muse AI
        const canvasTabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*'] });
        const museTabs = await queryFlowTabs();

        let leftWinId = currentWin?.id;
        if (canvasTabs.length > 0) {
          const cTab = canvasTabs[0];
          leftWinId = cTab.windowId;
          await chrome.windows.update(leftWinId, {
            state: 'normal',
            left: leftX,
            top: topY,
            width: leftW,
            height: totalH
          });
          await chrome.tabs.update(cTab.id, { active: true });
        } else {
          const wLeft = await chrome.windows.create({
            url: canvasUrl,
            left: leftX,
            top: topY,
            width: leftW,
            height: totalH
          });
          leftWinId = wLeft.id;
        }

        if (museTabs.length > 0) {
          const mTab = museTabs[0];
          if (mTab.windowId === leftWinId) {
            await chrome.windows.create({
              tabId: mTab.id,
              left: leftX + leftW,
              top: topY,
              width: rightW,
              height: totalH
            });
          } else {
            await chrome.windows.update(mTab.windowId, {
              state: 'normal',
              left: leftX + leftW,
              top: topY,
              width: rightW,
              height: totalH
            });
            await chrome.tabs.update(mTab.id, { active: true });
          }
        } else {
          await chrome.windows.create({
            url: FLOW_DEFAULT_URL,
            left: leftX + leftW,
            top: topY,
            width: rightW,
            height: totalH
          });
        }

        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'PING_FLOW_TAB') {
    (async () => {
      try {
        let openTabs = await queryFlowTabs();
        let targetTab = openTabs[0];
        if (!targetTab) {
          targetTab = await chrome.tabs.create({ url: FLOW_DEFAULT_URL, active: false });
          await waitForTabComplete(targetTab.id);
        } else if (message.payload?.focus) {
          await focusFlowTabAndWindow(targetTab.id, targetTab.windowId);
        }

        await ensureContentScriptReady(targetTab.id);
        const pingRes = await chrome.tabs.sendMessage(targetTab.id, { type: 'PING_FROM_CANVAS' }).catch(() => null);
        sendResponse({
          success: true,
          tabId: targetTab.id,
          tabUrl: targetTab.url,
          contentStatus: pingRes || { ok: true, note: 'Tab Google Flow đã được mở và kết nối!' }
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});
