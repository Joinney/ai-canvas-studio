/**
 * CANVAS BRIDGE (v3.5) - NHÚNG VÀO TRANG WEB CANVAS (localhost / 127.0.0.1)
 * Cho phép trang React (Web Canvas) gọi thẳng sang Chrome Extension Worker Pool.
 * Tự động gỡ bỏ mọi Listener cũ và kết nối tức thì (0ms) không cần F5.
 */

(function initCanvasBridge() {
  if (window.__AI_CANVAS_BRIDGE_HANDLER__) {
    window.removeEventListener('message', window.__AI_CANVAS_BRIDGE_HANDLER__);
  }

  const isContextValid = () => {
    try {
      return Boolean(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  };

  if (isContextValid()) {
    document.documentElement.setAttribute('data-ai-canvas-extension', 'connected');
    console.log('🟢 [AI Canvas Bridge v3.5] Đã kết nối trực tiếp với Chrome Extension!');
  }

  const handleBridgeMessage = (event) => {
    if (!event.data || event.data.source !== 'AI_CANVAS_WEB') return;

    const { type, jobId, payload } = event.data;
    if (
      type !== 'QUEUE_FLOW_JOB' &&
      type !== 'GET_POOL_STATUS' &&
      type !== 'PING_FLOW_TAB' &&
      type !== 'RESET_FLOW_WORKERS'
    ) {
      return;
    }

    if (!isContextValid()) {
      document.documentElement.removeAttribute('data-ai-canvas-extension');
      window.removeEventListener('message', handleBridgeMessage);
      window.postMessage(
        {
          source: 'AI_CANVAS_EXTENSION',
          type: `${type}_DEAD`,
          jobId
        },
        '*'
      );
      return;
    }

    // Phản hồi ACK ngay lập tức (0ms) để Web Canvas biết lệnh đã vào Extension
    if (type === 'QUEUE_FLOW_JOB') {
      window.postMessage(
        {
          source: 'AI_CANVAS_EXTENSION',
          type: 'QUEUE_FLOW_JOB_ACK',
          jobId
        },
        '*'
      );
    }

    try {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        const lastErr = chrome.runtime.lastError;
        window.postMessage(
          {
            source: 'AI_CANVAS_EXTENSION',
            type: `${type}_RESULT`,
            jobId,
            response:
              response || {
                success: false,
                error: lastErr?.message || 'Không nhận được phản hồi từ Background Worker'
              }
          },
          '*'
        );
      });
    } catch (err) {
      document.documentElement.removeAttribute('data-ai-canvas-extension');
      window.postMessage(
        {
          source: 'AI_CANVAS_EXTENSION',
          type: `${type}_DEAD`,
          jobId,
          error: err.message
        },
        '*'
      );
    }
  };

  window.__AI_CANVAS_BRIDGE_HANDLER__ = handleBridgeMessage;
  window.addEventListener('message', handleBridgeMessage);

  window.dispatchEvent(new CustomEvent('AI_CANVAS_EXTENSION_READY'));
  window.postMessage({ source: 'AI_CANVAS_EXTENSION', type: 'BRIDGE_READY', version: '5.2.0' }, '*');
})();
