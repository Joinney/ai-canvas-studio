import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:5001/api/ai' });

let directFlowWindow = null;

window.addEventListener('message', (event) => {
  if (event.data && event.data.source === 'AI_CANVAS_EXTENSION' && event.data.type === 'FLOW_WINDOW_CONNECTED') {
    directFlowWindow = event.source;
    window.dispatchEvent(new CustomEvent('AI_CANVAS_EXTENSION_READY'));
  }
});

export function hasDirectFlowWindow() {
  return Boolean(directFlowWindow && !directFlowWindow.closed);
}

/**
 * Mở hoặc kết nối trực tiếp với tab Google Flow từ Web Canvas
 */
export function openAndLinkGoogleFlowTab() {
  directFlowWindow = window.open('https://muse.ai/?activation_view=setup', 'AI_CANVAS_FLOW_WORKER');
  return directFlowWindow;
}

/**
 * Làm mới trạng thái hàng đợi Worker trong Chrome Extension trước khi bắt đầu lượt chạy mới
 */
export function resetFlowWorkers() {
  try {
    window.postMessage(
      {
        source: 'AI_CANVAS_WEB',
        type: 'RESET_FLOW_WORKERS',
        jobId: 'reset-' + Date.now()
      },
      '*'
    );
  } catch (e) {}
}

/**
 * Kiểm tra xem Chrome Extension đã được cài đặt và kết nối với Web Canvas chưa
 */
export async function getFlowPoolStatus(timeoutMs = 800) {
  const directStatus = await new Promise((resolve) => {
    const jobId = 'status-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const timer = setTimeout(() => {
      window.removeEventListener('message', handleMsg);
      resolve({ connected: false });
    }, timeoutMs);

    function handleMsg(event) {
      if (!event.data || event.data.source !== 'AI_CANVAS_EXTENSION' || event.data.jobId !== jobId) return;
      if (event.data.type === 'GET_POOL_STATUS_DEAD') {
        clearTimeout(timer);
        window.removeEventListener('message', handleMsg);
        resolve({ connected: false });
        return;
      }
      if (event.data.type === 'GET_POOL_STATUS_RESULT') {
        clearTimeout(timer);
        window.removeEventListener('message', handleMsg);
        resolve({ connected: true, channel: 'direct', ...(event.data.response || {}) });
      }
    }

    window.addEventListener('message', handleMsg);
    window.postMessage(
      {
        source: 'AI_CANVAS_WEB',
        type: 'GET_POOL_STATUS',
        jobId
      },
      '*'
    );
  });

  if (directStatus.connected) return directStatus;

  // Fallback sang Backend Relay (background.js luôn giữ nhịp Heartbeat 1.5s với localhost:5001)
  try {
    const { data } = await api.get('/flow-bridge/status', { timeout: 1200 });
    if (data && data.connected) {
      return {
        connected: true,
        channel: 'backend-relay',
        openFlowTabs: data.openFlowTabs || 1,
        maxConcurrentTabs: data.maxConcurrentTabs || 3
      };
    }
  } catch (e) {}

  return { connected: false };
}

/**
 * Bắn tín hiệu Ping trực tiếp từ Web Canvas sang tab Google Flow để kiểm tra kết nối 2 chiều
 */
export async function pingGoogleFlowTab(timeoutMs = 3000) {
  const directPing = await new Promise((resolve) => {
    const jobId = 'ping-' + Date.now();
    const timer = setTimeout(() => {
      window.removeEventListener('message', handleMsg);
      resolve(null);
    }, timeoutMs);

    function handleMsg(event) {
      if (!event.data || event.data.source !== 'AI_CANVAS_EXTENSION' || event.data.jobId !== jobId) return;
      if (event.data.type === 'PING_FLOW_TAB_DEAD') {
        clearTimeout(timer);
        window.removeEventListener('message', handleMsg);
        resolve(null);
        return;
      }
      if (event.data.type === 'PING_FLOW_TAB_RESULT') {
        clearTimeout(timer);
        window.removeEventListener('message', handleMsg);
        resolve(event.data.response);
      }
    }

    window.addEventListener('message', handleMsg);
    window.postMessage(
      {
        source: 'AI_CANVAS_WEB',
        type: 'PING_FLOW_TAB',
        jobId
      },
      '*'
    );
  });

  if (directPing && directPing.success) return directPing;

  // Fallback sang Backend Relay (background.js sẽ tự mở/focus tab Google Flow và nhúng content.js)
  try {
    const { data } = await api.post('/flow-bridge/dispatch', {
      type: 'PING_FLOW_TAB',
      payload: {}
    });
    if (data && data.success && data.response) {
      return data.response;
    }
  } catch (e) {}

  throw new Error(
    'Không nhận được phản hồi từ Extension. Hãy bấm nút Reload (🔄) Extension trong chrome://extensions rồi thử lại!'
  );
}

/**
 * Nén ảnh Base64 cục bộ (do người dùng tải lên) sang chuẩn JPEG nhẹ (<180KB, max 1024px).
 * Với link HTTP(S) bên ngoài, truyền thẳng 0ms sang Chrome Extension (background.js v3.5 sẽ tự tải & chuẩn hóa bằng OffscreenCanvas siêu tốc, không bao giờ làm trễ lệnh!).
 */
async function compressImageForFlow(inputSrc) {
  if (!inputSrc || typeof inputSrc !== 'string') return '';

  // Nếu là URL http(s), trả về ngay lập tức trong 0ms để background.js xử lý trực tiếp
  if (!inputSrc.startsWith('data:')) {
    return inputSrc;
  }

  // Nếu là ảnh data:image nhẹ sẵn (< 200KB) và là jpeg/png chuẩn thì gửi luôn
  if (inputSrc.length < 200000 && /^data:image\/(jpeg|jpg|png);base64,/i.test(inputSrc)) {
    return inputSrc;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(inputSrc), 2000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const maxDim = 1024;
        let w = img.naturalWidth || img.width || 800;
        let h = img.naturalHeight || img.height || 800;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.88));
      } catch (err) {
        resolve(inputSrc);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(inputSrc);
    };

    img.src = inputSrc;
  });
}

async function ensureBase64MediaList(images = []) {
  const validList = (images || []).filter(Boolean);
  const converted = [];
  for (const item of validList) {
    const fastImg = await compressImageForFlow(item);
    converted.push(fastImg || item);
  }
  return converted;
}

/**
 * Chuẩn hóa câu lệnh Prompt từ định dạng da-ai-canvas (@图片1, @图片2, 中图1, 中图2, <br>, tiếng Trung/Việt)
 * sang câu lệnh chuẩn mực cho Google Flow (Imagen 3 & Veo 2).
 * Phân định rạch ròi: Ảnh 1 là Mẫu (Model giữ nguyên mặt & vóc dáng), Ảnh 2 là Trang phục (Outfit khoác lên người).
 */
export function sanitizePromptForGoogleFlow(rawPrompt = '', mode = 'IMAGE', imagesCount = 2) {
  const text = String(rawPrompt || '').trim();
  if (!text) {
    return mode === 'VIDEO'
      ? 'Smooth 9:16 vertical fashion video of the model wearing this outfit, natural camera motion, high detail'
      : 'Photorealistic virtual try-on: The female model from the first reference image (@Image 1) wears the complete outfit from the second reference image (@Image 2), keeping her pose and environment unchanged.';
  }

  if (mode === 'VIDEO') {
    let basePrompt = '';
    // 1. Dự án Mẫu 1: Winter Velvet Fur Coat (Sofa 90 độ Top-Down)
    if (text.includes('Winter Velvet') || text.includes('冬日绒华') || text.includes('真皮沙发') || text.includes('顶俯拍')) {
      basePrompt = '90-degree top-down overhead static camera shot of a fashion model wearing the luxury winter fur coat, lying gracefully on a vintage caramel leather sofa over a fluffy cream wool rug, warm afternoon sunlight chiaroscuro lighting, rhythmic pose transitions showcasing the fur texture, Old Money vintage color grading, 9:16 vertical fashion video';
    } else if (text.includes('胶片实拍') || text.includes('性感轻熟风') || text.includes('电影级真实光影')) {
      // 2. Dự án Mẫu 2: Nhánh 35mm Retro Film Selfie (bản tiếng Trung cũ)
      basePrompt = 'Authentic 35mm film camera shot, soft natural daylight from left window, high contrast, translucent skin texture with fine film grain, cinematic lighting and hair rim light. Total duration 7 seconds, smooth 9:16 vertical video: The female model from @Image 1 keeps her exact identity and outfit throughout. 0-2s: The girl wearing @Image 1 lifts phone to camera angle taking a mirror selfie, turning slightly to mirror and lightly brushing hair, tapping foot; 2-7s: Subtly adjusts pose, necklace, and skirt hem, mirror reflects the full outfit in bright clean daylight, smooth natural motion, distortion-free face, seamless one-take continuous shot, chic mature aesthetic.';
    } else if (text.includes('韩系') || text.includes('对镜自拍') || text.includes('街头休闲风') || text.includes('整理肩带')) {
      // 3. Dự án Mẫu 2: Nhánh Korean Street Casual Selfie (bản tiếng Trung cũ)
      basePrompt = 'Total duration 7 seconds, smooth 9:16 vertical video: The female model from the reference image (@Image 1) keeps her exact identity, facial features, and full outfit completely unchanged throughout the video. 0-2s: Holding her phone up to camera angle taking a mirror selfie, turning slightly to the mirror and lightly brushing her hair with a relaxed Korean street casual aesthetic. 2-7s: Turns subtly towards the mirror, micro-adjusting her stance and shoulder straps, gently touching her dress hem. The mirror clearly reflects her full-body outfit in bright natural daylight, minimalist clean background, seamless fluid movement, face distortion-free, continuous one-take shot with authentic street film texture.';
    } else {
      const cleanVid = text.replace(/<br\s*\/?>/gi, ' ').replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
      basePrompt = cleanVid;
    }

    return `Generate and render this video now. Direct execution required, execute media generation tool immediately. IMPORTANT LANGUAGE RULE: Any spoken dialogue, voiceover, or speech in the audio MUST be strictly in natural Vietnamese (never Chinese or Mandarin): ${basePrompt}`;
  }

  // Chế độ IMAGE: Chỉ chuẩn hóa các prompt tiếng Trung cũ của Dự án 1 & 2; giữ nguyên prompt của từng dự án mới!
  if (mode === 'IMAGE') {
    const hasLegacyChineseMirrorTryOn = /环境及姿势保持不变|姿势保持不变|穿上.*全套服装/i.test(text);
    const hasLegacyChineseThreeAngle = /三视图|特征保持不变/i.test(text);

    if (hasLegacyChineseMirrorTryOn) {
      return 'Generate and create this virtual fashion try-on image now. Direct execution required: The female model from the first reference image (@Image 1) wears the complete outfit and clothing shown in the second reference image (@Image 2). CRITICAL INSTRUCTION: Keep the exact same female model, her face, her body posture, her mirror selfie pose holding phone in hand, and the room environment setting from the first reference image (@Image 1) completely unchanged! Only replace the clothes on her body with the exact garment, colors, and fabric texture from @Image 2. Ultra-realistic, 8k resolution, authentic fabric drape, seamless integration.';
    }

    if (hasLegacyChineseThreeAngle) {
      const keepFace = /保持脸型|脸型不变/i.test(text);
      const rosySkin = /皮肤保持红润|红润/i.test(text);
      const redLipstick = /口红/i.test(text);

      const details = [];
      if (keepFace) {
        details.push('Keep the exact female face shape, facial features, and model identity from the first reference image (Image 1) completely unchanged.');
      }
      details.push('Maintain the exact 3-angle lookbook composition (front view, side view, back view) and framing from Image 1.');
      if (rosySkin) {
        details.push('Skin glowing, radiant, smooth, with a natural rosy tone.');
      }
      if (redLipstick) {
        details.push('Natural elegant autumn-winter red lipstick.');
      }

      const extraText = details.length > 0 ? ' ' + details.join(' ') : '';
      return `Generate and create this fashion lookbook image now. Direct execution required: Create a high-resolution photorealistic fashion lookbook (3-angle character sheet: front, side, back view): The female model from the first reference image (Image 1) is the main subject. Dress her in the exact clothing, garment design, fabric texture, and cut shown in the second reference image (Image 2).${extraText} Studio fashion lighting, 8k resolution, ultra-detailed photography.`;
    }

    const cleaned = text
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/@图片(\d+)|中图(\d+)/g, '@Image $1$2')
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return `Generate and create this image now. Direct execution required using the attached reference images: ${cleaned}`;
  }

  return text;
}

/**
 * Gửi 1 tác vụ Node sang Chrome Extension Worker Pool (background.js -> content.js trên Google Flow).
 * Có cơ chế ACK 1.2s: Nếu Kênh 1 (window.postMessage) chưa F5, lập tức đẩy qua Kênh Backend Relay (0ms trễ, không bao giờ treo "Đang chờ")!
 */
export async function executeGoogleFlowNode(rawPayload, timeoutMs = 600000) {
  const safeImages = await ensureBase64MediaList(rawPayload?.images || []);
  const safePrompt = sanitizePromptForGoogleFlow(rawPayload?.prompt, rawPayload?.mode || 'IMAGE', safeImages.length);
  const payload = {
    ...rawPayload,
    images: safeImages,
    prompt: safePrompt
  };

  // Thử Kênh 1 (Direct Content Script Bridge)
  const isExtensionConnected =
    document.documentElement.getAttribute('data-ai-canvas-extension') === 'connected' ||
    typeof window.__AI_CANVAS_BRIDGE_HANDLER__ === 'function';

  const directAttempt = await new Promise((resolve) => {
    const jobId = 'flow-job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    let ackReceived = false;

    // Nếu Extension đang kết nối, cho thời gian chờ ACK lên tới 6000ms. Nếu chưa kết nối thì 2500ms để fallback sang relay
    const ackWaitTime = isExtensionConnected ? 6000 : 2500;
    const ackTimer = setTimeout(() => {
      if (!ackReceived) {
        window.removeEventListener('message', handleMessage);
        resolve({ fallbackToRelay: true });
      }
    }, ackWaitTime);

    const jobTimer = setTimeout(() => {
      window.removeEventListener('message', handleMessage);
      resolve({
        done: true,
        error: 'Quá thời gian phản hồi từ AI Engine (240s)'
      });
    }, timeoutMs);

    function handleMessage(event) {
      if (!event.data || event.data.source !== 'AI_CANVAS_EXTENSION' || event.data.jobId !== jobId) return;

      if (event.data.type === 'QUEUE_FLOW_JOB_ACK') {
        ackReceived = true;
        clearTimeout(ackTimer);
        return;
      }

      if (event.data.type === 'QUEUE_FLOW_JOB_DEAD') {
        clearTimeout(ackTimer);
        clearTimeout(jobTimer);
        window.removeEventListener('message', handleMessage);
        resolve({ fallbackToRelay: true });
        return;
      }

      if (event.data.type === 'QUEUE_FLOW_JOB_RESULT') {
        clearTimeout(ackTimer);
        clearTimeout(jobTimer);
        window.removeEventListener('message', handleMessage);
        const res = event.data.response;
        if (res && res.success && res.ok) {
          resolve({ done: true, result: res });
        } else {
          resolve({
            done: true,
            error: res?.error || 'Lỗi thực thi Node trên AI Engine'
          });
        }
      }
    }

    window.addEventListener('message', handleMessage);
    window.postMessage(
      {
        source: 'AI_CANVAS_WEB',
        type: 'QUEUE_FLOW_JOB',
        jobId,
        payload
      },
      '*'
    );
  });

  if (directAttempt.done) {
    if (directAttempt.result) return directAttempt.result;
    throw new Error(directAttempt.error);
  }

  // Kênh 2 (Backend Relay) chỉ kích hoạt khi Kênh 1 không có Extension
  const { data } = await api.post(
    '/flow-bridge/dispatch',
    {
      type: 'QUEUE_FLOW_JOB',
      payload
    },
    { timeout: timeoutMs }
  );

  const res = data?.response;
  if (res && res.success && res.ok) {
    return res;
  }
  throw new Error(res?.error || data?.error || 'Lỗi thực thi Node trên AI Engine');
}

/**
 * Chạy toàn bộ Pipeline 4 Cột
 */
export async function runFourColumnFashionWorkflow({
  modelImageBase64,
  outfitImagesBase64 = [],
  imagePrompt = 'Full body 3-angle character sheet (front, side, back) wearing this exact outfit, studio lighting',
  videoPrompt = 'Fashion model walking confidently on studio runway, smooth camera motion, 9:16 vertical video',
  bgmAudioUrl = null,
  onProgress = () => {}
}) {
  const column2Results = [];
  for (let index = 0; index < outfitImagesBase64.length; index++) {
    const outfitB64 = outfitImagesBase64[index];
    onProgress({ step: 2, message: `Đang tạo ảnh 3 chiều Nhánh ${index + 1}/${outfitImagesBase64.length} (Cột 2)...` });
    const res = await executeGoogleFlowNode({
      mode: 'IMAGE',
      images: [modelImageBase64, outfitB64],
      prompt: imagePrompt
    });
    const out = res.base64 || res.rawUrl;
    onProgress({ step: 2, branchIndex: index, resultBase64: out });
    column2Results.push(out);
  }

  const column3Results = [];
  for (let index = 0; index < column2Results.length; index++) {
    const col2ImageB64 = column2Results[index];
    onProgress({ step: 3, message: `Đang tạo Video 480p (Veo 2) ở Cột 3 (${index + 1}/${column2Results.length})...` });
    const res = await executeGoogleFlowNode({
      mode: 'VIDEO',
      aspectRatio: '9:16',
      resolution: '480p',
      images: [col2ImageB64],
      prompt: videoPrompt
    });
    const out = res.base64 || res.rawUrl;
    onProgress({ step: 3, branchIndex: index, resultBase64: out });
    column3Results.push(out);
  }

  onProgress({ step: 4, message: 'Đang Upscale lên 1080p HD và ghép nhạc nền bằng FFmpeg (Cột 4)...' });
  const column4Results = await Promise.all(
    column3Results.map(async (video480pB64, index) => {
      const { data } = await api.post('/upscale-mux', {
        videoSource: video480pB64,
        audioSource: bgmAudioUrl,
        targetResolution: '1080x1920'
      });
      onProgress({ step: 4, branchIndex: index, resultBase64: data.videoUrl });
      return data.videoUrl;
    })
  );

  return {
    column2Images: column2Results,
    column3Videos480p: column3Results,
    column4VideosHD: column4Results
  };
}
