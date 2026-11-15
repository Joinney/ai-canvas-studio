/**
 * BƯỚC 1 & BƯỚC 2: SCRIPT TEST TRỰC TIẾP TRÊN CONSOLE CỦA GOOGLE FLOW
 * Cách dùng:
 * 1. Mở tab Google Flow (https://labs.google/fx/vi/tools/flow hoặc flow.google.com)
 * 2. Bấm F12 -> chọn tab Console
 * 3. Copy toàn bộ file này dán vào Console và nhấn Enter
 * 4. Gọi hàm: await window.testFlowStep1({ prompt: "Model wearing streetwear outfit, 3-angle view: front, side, back", mode: "IMAGE" })
 */

(function initGoogleFlowConsoleTester() {
  // Cấu hình bộ Selector linh hoạt (hỗ trợ nhiều phiên bản DOM của Google Flow / Labs FX)
  const SELECTORS = {
    fileInput: 'input[type="file"]',
    dropZone: '[data-testid*="drop"], [aria-label*="Upload"], [aria-label*="Tải lên"], form, main',
    promptInput: 'textarea, [contenteditable="true"][role="textbox"], div[contenteditable="true"]',
    generateBtn: 'button[type="submit"], button[aria-label*="Generate"], button[aria-label*="Tạo"], button[aria-label*="Create"], button[aria-label*="Gửi"]',
    modeImageBtn: 'button[aria-label*="Image"], button[aria-label*="Ảnh"], [role="tab"][aria-label*="Image"]',
    modeVideoBtn: 'button[aria-label*="Video"], [role="tab"][aria-label*="Video"]',
    resultMedia: 'video[src^="blob:"], video[src^="https://"], img[src^="blob:https://labs.google"], img[src*="googleusercontent.com"]'
  };

  // 1. Hàm chuyển URL ảnh/video (blob: hoặc googleusercontent) sang Base64 sạch ngay trong tab Google Flow
  async function convertFlowUrlToBase64(mediaUrl) {
    const response = await fetch(mediaUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result); // data:image/png;base64,... hoặc data:video/mp4;base64,...
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // 2. Hàm chuyển chuỗi Base64 thành đối tượng File để nạp vào DataTransfer
  async function base64ToFile(base64Data, filename = 'input.png') {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/png' });
  }

  // 3. Tạo ảnh mẫu tự động (nếu test nhanh trên Console mà chưa truyền ảnh vào)
  function createSampleBase64Image(label, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 256, 256);
    return canvas.toDataURL('image/png');
  }

  // 4. Tự động chuyển đổi chế độ IMAGE <-> VIDEO (480p)
  async function switchFlowMode(mode = 'IMAGE') {
    console.log(`🔄 [FlowTester] Đang chuyển sang chế độ: ${mode}`);
    const buttons = Array.from(document.querySelectorAll('button, [role="tab"], [role="menuitem"]'));

    if (mode === 'IMAGE') {
      const imgBtn = buttons.find((el) => /create image|imagen|tạo ảnh|image/i.test(el.innerText || el.getAttribute('aria-label') || ''));
      if (imgBtn) imgBtn.click();
    } else if (mode === 'VIDEO') {
      const vidBtn = buttons.find((el) => /create video|veo|tạo video|video/i.test(el.innerText || el.getAttribute('aria-label') || ''));
      if (vidBtn) vidBtn.click();
      await new Promise((r) => setTimeout(r, 400));

      // Chọn tỷ lệ 9:16 và chất lượng 480p nếu đang hiển thị trên thanh công cụ
      const allBtns = Array.from(document.querySelectorAll('button, [role="option"]'));
      const ratioBtn = allBtns.find((el) => /9:16/i.test(el.innerText || el.getAttribute('aria-label') || ''));
      if (ratioBtn) ratioBtn.click();

      const res480Btn = allBtns.find((el) => /480p/i.test(el.innerText || el.getAttribute('aria-label') || ''));
      if (res480Btn) res480Btn.click();
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // 5. Tự động nạp 1 hoặc 2 tấm ảnh vào ô Upload của Google Flow
  async function uploadImagesToFlow(base64Images = []) {
    const files = await Promise.all(
      base64Images.map((b64, idx) => base64ToFile(b64, `flow_input_${idx + 1}.png`))
    );

    const dataTransfer = new DataTransfer();
    files.forEach((file) => dataTransfer.items.add(file));

    // Cách A: Tìm thẻ <input type="file"> (kể cả bị ẩn)
    let fileInput = document.querySelector(SELECTORS.fileInput);
    if (fileInput) {
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));
      console.log(`✅ [FlowTester] Đã nạp ${files.length} ảnh qua <input type="file">`);
      await new Promise((r) => setTimeout(r, 800));
      return true;
    }

    // Cách B: Giả lập sự kiện Drag & Drop hoặc Paste trực tiếp vào ô nhập Prompt / Dropzone
    const dropTarget = document.querySelector(SELECTORS.promptInput) || document.querySelector(SELECTORS.dropZone) || document.body;
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    });
    dropTarget.dispatchEvent(pasteEvent);

    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer
    });
    dropTarget.dispatchEvent(dropEvent);
    console.log(`✅ [FlowTester] Đã nạp ${files.length} ảnh qua sự kiện Paste/Drop`);
    await new Promise((r) => setTimeout(r, 800));
    return true;
  }

  // 6. Tự động điền Prompt chuẩn React/Angular/Lit (vượt qua cơ chế chặn gán .value thông thường)
  async function fillFlowPrompt(promptText) {
    const promptEl = document.querySelector(SELECTORS.promptInput);
    if (!promptEl) {
      throw new Error('Không tìm thấy ô nhập Prompt trên giao diện Google Flow!');
    }

    promptEl.focus();
    if (promptEl.tagName === 'TEXTAREA' || promptEl.tagName === 'INPUT') {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(promptEl, promptText);
      } else {
        promptEl.value = promptText;
      }
      promptEl.dispatchEvent(new Event('input', { bubbles: true }));
      promptEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Với thẻ div[contenteditable="true"]
      promptEl.innerText = promptText;
      promptEl.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText }));
    }
    console.log('✅ [FlowTester] Đã điền Prompt:', promptText);
    await new Promise((r) => setTimeout(r, 400));
  }

  // 7. Bấm nút Generate và đợi kết quả trả về (bắt cả DOM MutationObserver)
  function waitForNewMediaResult(existingUrls, timeoutMs = 90000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error('Hết thời gian chờ (Timeout) kết quả từ Google Flow!'));
      }, timeoutMs);

      const checkDomForNewMedia = async () => {
        const elements = Array.from(document.querySelectorAll(SELECTORS.resultMedia));
        for (const el of elements) {
          const src = el.currentSrc || el.src;
          if (src && !existingUrls.has(src)) {
            existingUrls.add(src);
            clearTimeout(timer);
            observer.disconnect();
            console.log('🎉 [FlowTester] Phát hiện Media mới sinh ra:', src);
            try {
              const base64 = await convertFlowUrlToBase64(src);
              resolve({ rawUrl: src, base64 });
            } catch (err) {
              resolve({ rawUrl: src, base64: null, error: err.message });
            }
            return;
          }
        }
      };

      const observer = new MutationObserver(() => {
        checkDomForNewMedia();
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src']
      });
    });
  }

  // 8. Hàm chạy tổng hợp Bước 1 & Bước 2
  window.testFlowStep1 = async function ({
    images = [
      createSampleBase64Image('ANH NGUOI MAU', '#4f46e5'),
      createSampleBase64Image('BO QUAN AO 1', '#059669')
    ],
    prompt = 'Full body 3-angle view (front, side, back) of the model wearing this exact outfit, studio lighting, consistent character',
    mode = 'IMAGE'
  } = {}) {
    console.log('🚀 [FlowTester] Bắt đầu chạy thử nghiệm Bước 1 & Bước 2...');

    // Ghi nhận các ảnh/video đang có sẵn trên trang để tránh bắt nhầm ảnh cũ
    const existingUrls = new Set(
      Array.from(document.querySelectorAll(SELECTORS.resultMedia))
        .map((el) => el.currentSrc || el.src)
        .filter(Boolean)
    );

    await switchFlowMode(mode);
    await uploadImagesToFlow(images);
    await fillFlowPrompt(prompt);

    // Tìm và bấm nút Generate (hoặc nhấn phím Enter)
    const genBtn = document.querySelector(SELECTORS.generateBtn);
    if (genBtn && !genBtn.disabled) {
      genBtn.click();
      console.log('⚡ [FlowTester] Đã bấm nút Generate! Đang chờ kết quả...');
    } else {
      const promptEl = document.querySelector(SELECTORS.promptInput);
      promptEl?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      console.log('⚡ [FlowTester] Đã gửi phím Enter để Generate! Đang chờ kết quả...');
    }

    const result = await waitForNewMediaResult(existingUrls);
    console.log('✅ [FlowTester] KẾT QUẢ CUỐI CÙNG (Raw URL & Base64 sạch):', {
      rawUrl: result.rawUrl,
      base64Preview: result.base64 ? result.base64.slice(0, 80) + '...' : 'Không chuyển được Base64',
      base64Length: result.base64 ? result.base64.length : 0
    });
    return result;
  };

  window.convertFlowUrlToBase64 = convertFlowUrlToBase64;
  console.log(
    '%c✅ Google Flow Console Tester đã sẵn sàng! Gọi lệnh: await window.testFlowStep1() để test ngay.',
    'color: #10b981; font-weight: bold; font-size: 14px;'
  );
})();
