// Bộ xử lý tổng hợp Video AI Seedance bằng HTML5 Canvas + MediaRecorder (60 FPS)
// Hỗ trợ:
// 1. Chế độ Tham chiếu đa năng (@参考): Kết hợp @Ảnh1 + @Ảnh2 + @VideoThamChiếu
// 2. Chế độ Khung Đầu - Khung Cuối (首尾帧): Chuyển cảnh điện ảnh từ @ẢnhĐầu -> @ẢnhCuối
// 3. Đi theo đường vẽ Motion Path trên Canvas hoặc ghép đa lớp 2.5D Parallax

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không thể tải ảnh để dựng video: ' + url));
    img.src = url;
  });

const getSupportedMimeType = () => {
  const types = [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4'
  ];
  for (const t of types) {
    if (window.MediaRecorder && window.MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
};

export async function synthesizeCanvasVideo({
  imageUrl,
  endImageUrl = null,
  referenceImageUrls = [],
  genMode = 'reference', // 'reference' | 'frames'
  aspectRatio = '9:16',
  layers = [],
  motionType = 'cinematic_zoom',
  motionPoints = [],
  targetLayer = null,
  prompt = '',
  durationMs = 4500,
  onProgress
}) {
  let width = 720;
  let height = 720;
  if (aspectRatio === '9:16') {
    width = 540;
    height = 960;
  } else if (aspectRatio === '16:9') {
    width = 960;
    height = 540;
  }

  const fps = 60;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Tải các ảnh tham chiếu (@Ảnh1, @Ảnh2...)
  const primaryUrl = imageUrl || referenceImageUrls[0];
  const mainImg = primaryUrl ? await loadImage(primaryUrl) : null;

  let endImg = null;
  if (endImageUrl) {
    try {
      endImg = await loadImage(endImageUrl);
    } catch (e) {
      endImg = null;
    }
  }

  const loadedRefImgs = [];
  for (const u of referenceImageUrls) {
    try {
      const im = await loadImage(u);
      loadedRefImgs.push(im);
    } catch (e) {
      // ignore
    }
  }

  const loadedLayers = [];
  if (layers.length > 0) {
    for (const l of layers) {
      if (l.type !== 'video' && l.url) {
        try {
          const im = await loadImage(l.url);
          loadedLayers.push({ ...l, imgElement: im });
        } catch (err) {
          // ignore
        }
      }
    }
  }

  const pLower = (prompt || '').toLowerCase();
  let accentColor = '255, 215, 130';
  if (pLower.includes('neon') || pLower.includes('cyber') || pLower.includes('tím')) {
    accentColor = '168, 85, 247';
  } else if (pLower.includes('xanh') || pLower.includes('blue') || pLower.includes('ngoài trời')) {
    accentColor = '56, 189, 248';
  } else if (pLower.includes('lửa') || pLower.includes('fire') || pLower.includes('gold')) {
    accentColor = '251, 146, 60';
  }

  const particles = Array.from({ length: 42 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 3.8 + 1,
    vx: (Math.random() - 0.5) * 0.9,
    vy: -Math.random() * 1.3 - 0.3,
    alpha: Math.random() * 0.65 + 0.15,
    phase: Math.random() * Math.PI * 2
  }));

  let normalizedPath = [];
  if (motionPoints && motionPoints.length >= 4 && targetLayer) {
    for (let i = 0; i < motionPoints.length; i += 2) {
      const px = motionPoints[i];
      const py = motionPoints[i + 1];
      const cx = targetLayer.x + targetLayer.width / 2;
      const cy = targetLayer.y + targetLayer.height / 2;
      const dx = ((px - cx) / targetLayer.width) * width * 0.45;
      const dy = ((py - cy) / targetLayer.height) * height * 0.45;
      normalizedPath.push({ dx, dy });
    }
  }

  const stream = canvas.captureStream(fps);
  const mimeType = getSupportedMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 6_000_000 } : undefined);

  const chunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const drawCoverOrContain = (img, boxW, boxH, cover = false) => {
    const imgAspect = img.width / img.height;
    const boxAspect = boxW / boxH;
    let drawW = boxW;
    let drawH = boxH;
    if (cover) {
      if (imgAspect > boxAspect) {
        drawH = boxH;
        drawW = boxH * imgAspect;
      } else {
        drawW = boxW;
        drawH = boxW / imgAspect;
      }
    } else {
      if (imgAspect > boxAspect) {
        drawW = boxW;
        drawH = boxW / imgAspect;
      } else {
        drawH = boxH;
        drawW = boxH * imgAspect;
      }
    }
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
  };

  return new Promise((resolve, reject) => {
    recorder.onerror = (e) => reject(e);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      resolve({ url, blob, mimeType: mimeType || 'video/webm', width, height });
    };

    recorder.start(100);
    const startTime = performance.now();

    let minX = 0, minY = 0, boxW = width, boxH = height;
    if (loadedLayers.length > 1) {
      minX = Math.min(...loadedLayers.map((i) => i.x));
      minY = Math.min(...loadedLayers.map((i) => i.y));
      const maxX = Math.max(...loadedLayers.map((i) => i.x + i.width));
      const maxY = Math.max(...loadedLayers.map((i) => i.y + i.height));
      boxW = Math.max(100, maxX - minX);
      boxH = Math.max(100, maxY - minY);
    }

    const renderFrame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      if (onProgress) onProgress(Math.round(progress * 100));

      const ease = 0.5 - 0.5 * Math.cos(progress * Math.PI);

      ctx.fillStyle = '#0d0d12';
      ctx.fillRect(0, 0, width, height);

      // CHẾ ĐỘ 1: KHUNG ĐẦU - KHUNG CUỐI (首尾帧 Start Frame -> End Frame)
      if (genMode === 'frames' && mainImg && endImg) {
        ctx.save();
        ctx.translate(width / 2, height / 2);

        // Khung đầu zoom vào và mờ dần
        ctx.save();
        ctx.globalAlpha = 1 - ease;
        const s1 = 1.0 + ease * 0.25;
        ctx.scale(s1, s1);
        drawCoverOrContain(mainImg, width, height, true);
        ctx.restore();

        // Khung cuối từ lớn thu về chuẩn và rõ dần
        ctx.save();
        ctx.globalAlpha = ease;
        const s2 = 1.25 - ease * 0.22;
        ctx.scale(s2, s2);
        drawCoverOrContain(endImg, width, height, true);
        ctx.restore();

        ctx.restore();
      }
      // CHẾ ĐỘ 2: ĐA THAM CHIẾU (@Ảnh1 + @Ảnh2 kết hợp như Case 1, Case 3, Case 5 trong Feishu)
      else if (genMode === 'reference' && loadedRefImgs.length >= 2) {
        const bgImg = loadedRefImgs[0]; // @Ảnh1 (Nhân vật / Bối cảnh)
        const fgImg = loadedRefImgs[1]; // @Ảnh2 (Sản phẩm / Trang phục tham chiếu)

        // Vẽ @Ảnh1 làm cảnh chính với chuyển động camera mượt
        ctx.save();
        ctx.translate(width / 2, height / 2);
        const bgScale = 1.02 + ease * 0.14;
        const bgPanX = Math.sin(progress * Math.PI) * 14;
        ctx.translate(bgPanX, 0);
        ctx.scale(bgScale, bgScale);
        drawCoverOrContain(bgImg, width, height, true);
        ctx.restore();

        // Lớp phủ ánh sáng chuyển giao
        ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
        ctx.fillRect(0, 0, width, height);

        // Vẽ @Ảnh2 (Sản phẩm/Trang phục) nổi 3D showcase góc dưới/giữa với hiệu ứng xuất hiện mượt
        ctx.save();
        const floatY = Math.sin(progress * Math.PI * 2) * 14;
        const fgScale = 0.56 + Math.sin(progress * Math.PI) * 0.08;
        ctx.translate(width * 0.5, height * 0.62 + floatY);
        ctx.rotate(Math.sin(progress * Math.PI * 2) * 0.03);
        ctx.scale(fgScale, fgScale);

        ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
        ctx.shadowBlur = 35;
        ctx.shadowOffsetY = 18;

        // Vẽ khung bo tròn phát sáng nhẹ cho sản phẩm tham chiếu @Ảnh2
        drawCoverOrContain(fgImg, width * 0.85, height * 0.65, false);
        ctx.restore();
      }
      // CHẾ ĐỘ 3: ĐA LỚP BỐ CỤC CANVAS 2.5D PARALLAX
      else if (loadedLayers.length > 1 && !imageUrl) {
        loadedLayers.forEach((layer, idx) => {
          const isBackground = idx === 0;
          const depthFactor = isBackground ? 0.35 : 1 + idx * 0.4;

          ctx.save();
          const relX = ((layer.x - minX) / boxW) * (width * 0.84) + width * 0.08;
          const relY = ((layer.y - minY) / boxH) * (height * 0.84) + height * 0.08;
          const relW = (layer.width / boxW) * (width * 0.84);
          const relH = (layer.height / boxH) * (height * 0.84);

          const cx = relX + relW / 2;
          const cy = relY + relH / 2;
          ctx.translate(cx, cy);

          if (isBackground) {
            const bgScale = 1.08 + ease * 0.08;
            ctx.scale(bgScale, bgScale);
          } else {
            const floatY = Math.sin(progress * Math.PI * 2) * 14 * depthFactor;
            const floatX = Math.cos(progress * Math.PI * 2) * 6 * depthFactor;
            const rot = Math.sin(progress * Math.PI * 2) * 0.035;
            const fgScale = 1 + Math.sin(progress * Math.PI) * 0.08;
            ctx.translate(floatX, floatY);
            ctx.rotate(rot);
            ctx.scale(fgScale, fgScale);
            ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
            ctx.shadowBlur = 24;
            ctx.shadowOffsetY = 16;
          }

          ctx.drawImage(layer.imgElement, -relW / 2, -relH / 2, relW, relH);
          ctx.restore();
        });
      }
      // CHẾ ĐỘ 4: 1 ẢNH THAM CHIẾU -> VIDEO AI
      else if (mainImg) {
        ctx.save();
        ctx.filter = 'blur(28px) brightness(0.45)';
        ctx.drawImage(mainImg, -40, -40, width + 80, height + 80);
        ctx.restore();

        ctx.save();
        ctx.translate(width / 2, height / 2);

        let scale = 1;
        let tx = 0;
        let ty = 0;
        let rot = 0;

        if (normalizedPath.length >= 2) {
          const floatIdx = ease * (normalizedPath.length - 1);
          const i0 = Math.floor(floatIdx);
          const i1 = Math.min(normalizedPath.length - 1, i0 + 1);
          const frac = floatIdx - i0;
          const startPt = normalizedPath[0];
          const curDx = normalizedPath[i0].dx + (normalizedPath[i1].dx - normalizedPath[i0].dx) * frac;
          const curDy = normalizedPath[i0].dy + (normalizedPath[i1].dy - normalizedPath[i0].dy) * frac;

          tx = curDx - startPt.dx;
          ty = curDy - startPt.dy;
          scale = 1.04 + Math.sin(progress * Math.PI) * 0.1;
          rot = (tx / width) * 0.12;
        } else if (motionType === 'cinematic_zoom') {
          scale = 1.0 + ease * 0.22;
          tx = Math.sin(progress * Math.PI) * 12;
          ty = -ease * 10;
        } else if (motionType === 'floating_3d') {
          scale = 0.88 + Math.sin(progress * Math.PI) * 0.08;
          ty = Math.sin(progress * Math.PI * 2) * 22;
          tx = Math.cos(progress * Math.PI * 2) * 10;
          rot = Math.sin(progress * Math.PI * 2) * 0.045;
        } else if (motionType === 'pan_showcase') {
          scale = 1.18;
          tx = -55 + ease * 110;
          ty = Math.sin(progress * Math.PI * 2) * 8;
        } else if (motionType === 'pulse_glow') {
          scale = 0.96 + Math.abs(Math.sin(progress * Math.PI * 3)) * 0.12;
          rot = Math.sin(progress * Math.PI * 2) * 0.025;
        }

        ctx.translate(tx, ty);
        ctx.rotate(rot);
        ctx.scale(scale, scale);

        ctx.shadowColor = 'rgba(0,0,0,0.65)';
        ctx.shadowBlur = 32;
        ctx.shadowOffsetY = 18;

        drawCoverOrContain(mainImg, width, height, false);
        ctx.restore();
      }

      // HIỆU ỨNG ÁNH SÁNG STUDIO QUÉT QUA (Cinematic Light Sweep)
      ctx.save();
      const sweepPos = -width * 0.6 + ease * (width * 2.2);
      const grad = ctx.createLinearGradient(sweepPos - 140, 0, sweepPos + 140, height);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.5, `rgba(${accentColor}, ${0.18 + Math.sin(progress * Math.PI) * 0.1})`);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // HẠT BỤI ÁNH SÁNG AI (Floating Bokeh & Sparkles)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) p.y = height + 10;
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const twinkle = 0.5 + 0.5 * Math.sin(progress * Math.PI * 6 + p.phase);
        const alpha = p.alpha * twinkle;

        const radGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3.2);
        radGrad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
        radGrad.addColorStop(0.4, `rgba(${accentColor}, ${alpha * 0.8})`);
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // Viền tối điện ảnh (Cinematic Vignette)
      ctx.save();
      const vig = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.32,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72
      );
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      if (elapsed < durationMs) {
        requestAnimationFrame(renderFrame);
      } else {
        recorder.stop();
      }
    };

    requestAnimationFrame(renderFrame);
  });
}
