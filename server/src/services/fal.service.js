const fs = require('fs');
const path = require('path');
const { fal } = require('@fal-ai/client');

let runtimeConfig = {
  falKey: process.env.FAL_KEY || '',
  arkApiKey: process.env.ARK_API_KEY || '',
  arkBaseUrl: process.env.ARK_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
};

if (runtimeConfig.falKey) {
  fal.config({ credentials: runtimeConfig.falKey });
}

exports.getConfigStatus = () => ({
  hasFalKey: Boolean(runtimeConfig.falKey),
  hasArkKey: Boolean(runtimeConfig.arkApiKey),
  arkBaseUrl: runtimeConfig.arkBaseUrl,
  activeProvider: runtimeConfig.falKey
    ? 'Fal.ai (ByteDance Seedance Cloud)'
    : runtimeConfig.arkApiKey
    ? 'ByteDance Ark / AI聚合平台 (Seedance)'
    : 'Free Cloud GPU (LTX-Video / Wan2.2 Real AI)'
});

exports.updateConfig = ({ falKey, arkApiKey, arkBaseUrl }) => {
  if (typeof falKey === 'string') runtimeConfig.falKey = falKey.trim();
  if (typeof arkApiKey === 'string') runtimeConfig.arkApiKey = arkApiKey.trim();
  if (typeof arkBaseUrl === 'string' && arkBaseUrl.trim()) runtimeConfig.arkBaseUrl = arkBaseUrl.trim();

  if (runtimeConfig.falKey) {
    process.env.FAL_KEY = runtimeConfig.falKey;
    fal.config({ credentials: runtimeConfig.falKey });
  }
  if (runtimeConfig.arkApiKey) {
    process.env.ARK_API_KEY = runtimeConfig.arkApiKey;
  }

  // Lưu vào file .env để giữ cấu hình lâu dài
  try {
    const envPath = path.join(__dirname, '../../.env');
    const envContent = [
      `PORT=${process.env.PORT || 5001}`,
      `FAL_KEY=${runtimeConfig.falKey}`,
      `ARK_API_KEY=${runtimeConfig.arkApiKey}`,
      `ARK_BASE_URL=${runtimeConfig.arkBaseUrl}`
    ].join('\n');
    fs.writeFileSync(envPath, envContent + '\n', 'utf8');
  } catch (e) {
    console.warn('Không thể ghi file .env:', e.message);
  }

  return exports.getConfigStatus();
};

const SEEDANCE_ENDPOINTS = {
  'seedance-2.0-mini': {
    ref2v: 'bytedance/seedance-2.0/reference-to-video',
    i2v: 'bytedance/seedance-2.0/fast/image-to-video',
    t2v: 'bytedance/seedance-2.0/fast/text-to-video'
  },
  'seedance-2.0': {
    ref2v: 'bytedance/seedance-2.0/reference-to-video',
    i2v: 'bytedance/seedance-2.0/image-to-video',
    t2v: 'bytedance/seedance-2.0/text-to-video'
  },
  'seedance-v1-lite': {
    ref2v: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    i2v: 'fal-ai/bytedance/seedance/v1/lite/image-to-video',
    t2v: 'fal-ai/bytedance/seedance/v1/lite/text-to-video'
  },
  'seedance-v1-pro': {
    ref2v: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    i2v: 'fal-ai/bytedance/seedance/v1/pro/image-to-video',
    t2v: 'fal-ai/bytedance/seedance/v1/pro/text-to-video'
  }
};

// Hàm upload ảnh (URL hoặc Base64 Data URI) lên Gradio Space để tạo Video AI thật
async function uploadImageToGradioSpace(spaceHost, imageSource) {
  if (!imageSource) return null;

  let buffer;
  let mimeType = 'image/png';
  let filename = 'canvas_input.png';

  if (imageSource.startsWith('data:')) {
    const match = imageSource.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Định dạng ảnh Base64 không hợp lệ');
    mimeType = match[1];
    buffer = Buffer.from(match[2], 'base64');
  } else {
    const res = await fetch(imageSource);
    if (!res.ok) throw new Error('Không thể tải ảnh gốc để gửi lên AI: ' + res.status);
    mimeType = res.headers.get('content-type') || 'image/jpeg';
    buffer = Buffer.from(await res.arrayBuffer());
    filename = 'input.' + (mimeType.includes('png') ? 'png' : 'jpg');
  }

  const formData = new FormData();
  const blob = new Blob([buffer], { type: mimeType });
  formData.append('files', blob, filename);

  const upRes = await fetch(`${spaceHost}/gradio_api/upload`, {
    method: 'POST',
    body: formData
  });
  if (!upRes.ok) {
    throw new Error('Upload ảnh lên Cloud GPU thất bại: ' + upRes.status);
  }
  const upPaths = await upRes.json();
  if (!Array.isArray(upPaths) || !upPaths[0]) {
    throw new Error('Không nhận được đường dẫn file từ Cloud GPU');
  }
  return {
    path: upPaths[0],
    url: `${spaceHost}/gradio_api/file=${upPaths[0]}`,
    orig_name: filename,
    mime_type: mimeType,
    meta: { _type: 'gradio.FileData' }
  };
}

// Chuẩn hóa câu lệnh tiếng Việt sang tiếng Anh điện ảnh cho model AI Video
function buildEnglishVideoPrompt(rawPrompt, motionType) {
  const motionMap = {
    cinematic_zoom: 'smooth cinematic camera push-in, dynamic subject motion, natural lighting, 4k commercial video',
    floating_3d: 'natural 3D subject movement, gentle camera orbit, realistic physics, studio lighting',
    pan_showcase: 'smooth horizontal camera pan, lifelike motion, high quality commercial shot',
    pulse_glow: 'vibrant studio lighting, dynamic motion, realistic textures, cinematic atmosphere',
    motion_path: 'smooth directional movement, natural subject animation, cinematic tracking shot'
  };
  const motionDesc = motionMap[motionType] || motionMap.cinematic_zoom;
  const cleaned = (rawPrompt || '')
    .replace(/@Ảnh\d+/gi, 'the subject')
    .replace(/@Video\d+/gi, 'the reference motion')
    .trim();

  return `${cleaned ? cleaned + ', ' : ''}${motionDesc}`;
}

// Gọi Cloud GPU AI thật (LTX-Video Distilled / Wan 2.2 14B) trên Hugging Face
async function generateRealVideoFreeCloud({
  prompt,
  imageUrl,
  endImageUrl,
  aspectRatio = '9:16',
  duration = '5',
  motionType = 'cinematic_zoom'
}) {
  const finalPrompt = buildEnglishVideoPrompt(prompt, motionType);

  // Tính kích thước chia hết cho 32 theo chuẩn LTX-Video (tối ưu tốc độ & nét)
  let width = 512;
  let height = 512;
  if (aspectRatio === '9:16') {
    width = 448;
    height = 768;
  } else if (aspectRatio === '16:9') {
    width = 768;
    height = 448;
  }

  // Ưu tiên 1: Gọi Wan 2.2 14B Cloud GPU khi có ảnh đầu vào (Hỗ trợ cả 1 ảnh tham chiếu và Khung Đầu - Cuối 首尾帧)
  if (imageUrl) {
    try {
      const wanHost = 'https://upsampler-wan-2-2-14b-image-to-video.hf.space';
      console.log('🎬 [Wan 2.2 14B Cloud GPU] Đang tải ảnh lên Cloud GPU để tạo Video AI thật...');
      const startFile = await uploadImageToGradioSpace(wanHost, imageUrl);
      const endFile = endImageUrl ? await uploadImageToGradioSpace(wanHost, endImageUrl) : null;

      const callRes = await fetch(`${wanHost}/gradio_api/call/generate_video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: [
            startFile,
            finalPrompt,
            4,
            '色调艳丽, 过曝, 静态, 细节模糊不清, 字幕, 最差质量, 低质量, 丑陋的, 残缺的, 静止不动的画面',
            Math.min(5, Math.max(2, Number(duration) || 3.5)),
            1,
            1,
            42,
            true,
            endFile
          ]
        })
      });
      const callJson = await callRes.json();
      if (callJson.event_id) {
        const sseRes = await fetch(`${wanHost}/gradio_api/call/generate_video/${callJson.event_id}`);
        const sseText = await sseRes.text();
        const completeIdx = sseText.lastIndexOf('event: complete');
        if (completeIdx !== -1) {
          const dataLine = sseText
            .slice(completeIdx)
            .split('\n')
            .find((l) => l.startsWith('data:'));
          if (dataLine) {
            const parsed = JSON.parse(dataLine.slice(5).trim());
            const videoObj = parsed[0]?.video || parsed[0];
            const url =
              videoObj?.url || (videoObj?.path ? `${wanHost}/gradio_api/file=${videoObj.path}` : null);
            if (url) {
              return {
                videoUrl: url,
                mode: 'wan-2.2-14b-cloud-gpu',
                endpoint: 'Wan-2.2-14B Real AI Video'
              };
            }
          }
        }
      }
    } catch (wanErr) {
      console.warn('Wan 2.2 14B đang bận, tự động chuyển sang LTX-Video Cloud GPU:', wanErr.message);
    }
  }

  // Mặc định gọi LTX-Video Distilled Cloud GPU (Tốc độ rất nhanh ~12-20 giây, tạo video AI thật 100%)
  const ltxHost = 'https://lightricks-ltx-video-distilled.hf.space';
  const endpointName = imageUrl ? 'image_to_video' : 'text_to_video';
  console.log(`🎬 [LTX-Video Cloud GPU] Đang tạo Video AI thật (${endpointName})...`);

  const uploadedImg = imageUrl ? await uploadImageToGradioSpace(ltxHost, imageUrl) : null;
  const durSec = Math.min(5, Math.max(2, Number(duration) || 3));

  const callRes = await fetch(`${ltxHost}/gradio_api/call/${endpointName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: [
        finalPrompt,
        'worst quality, inconsistent motion, blurry, jittery, distorted',
        uploadedImg,
        null,
        height,
        width,
        imageUrl ? 'image-to-video' : 'text-to-video',
        durSec,
        9,
        42,
        true,
        1,
        true
      ]
    })
  });

  if (!callRes.ok) {
    throw new Error('Không thể khởi tạo tác vụ trên Cloud GPU: HTTP ' + callRes.status);
  }

  const callJson = await callRes.json();
  if (!callJson.event_id) {
    throw new Error('Cloud GPU không trả về event_id');
  }

  const sseRes = await fetch(`${ltxHost}/gradio_api/call/${endpointName}/${callJson.event_id}`);
  const sseText = await sseRes.text();

  if (sseText.includes('event: error')) {
    const errLine = sseText.split('\n').find((l) => l.startsWith('data:'));
    throw new Error('Cloud GPU quá tải hoặc lỗi: ' + (errLine || 'Vui lòng thử lại sau vài giây'));
  }

  const completeIdx = sseText.lastIndexOf('event: complete');
  if (completeIdx === -1) {
    throw new Error('Không nhận được kết quả hoàn tất từ Cloud GPU');
  }

  const afterComplete = sseText.slice(completeIdx);
  const dataLine = afterComplete.split('\n').find((l) => l.startsWith('data:'));
  if (!dataLine) {
    throw new Error('Dữ liệu trả về từ Cloud GPU trống');
  }

  const parsed = JSON.parse(dataLine.slice(5).trim());
  const videoInfo = parsed[0]?.video || parsed[0];
  const videoUrl =
    videoInfo?.url || (videoInfo?.path ? `${ltxHost}/gradio_api/file=${videoInfo.path}` : null);

  if (!videoUrl) {
    throw new Error('Không tìm thấy URL video trong phản hồi của Cloud GPU');
  }

  return {
    videoUrl,
    mode: 'cloud-gpu-real-ai',
    endpoint: 'LTX-Video Real AI Diffusion'
  };
}

// Gọi trực tiếp API ByteDance Volcengine Ark / Trạm AI聚合平台 (chuẩn Seedance chính hãng)
async function generateSeedanceViaArk({
  prompt,
  imageUrl,
  endImageUrl,
  referenceImageUrls = [],
  model = 'seedance-2.0-mini',
  resolution = '720p',
  aspectRatio = '9:16',
  duration = '5'
}) {
  const baseUrl = runtimeConfig.arkBaseUrl.replace(/\/+$/, '');
  const apiKey = runtimeConfig.arkApiKey;

  const isBytePlusIntl = baseUrl.includes('bytepluses.com');
  const arkModelMap = isBytePlusIntl
    ? {
        'seedance-2.0-mini': 'seedance-1-0-lite-i2v-250428',
        'seedance-v1-lite': 'seedance-1-0-lite-i2v-250428',
        'seedance-v1-pro': 'seedance-1-0-pro-250528',
        'seedance-2.0': 'seedance-1-0-pro-250528'
      }
    : {
        'seedance-2.0-mini': 'doubao-seedance-1-0-lite-i2v-250428',
        'seedance-v1-lite': 'doubao-seedance-1-0-lite-i2v-250428',
        'seedance-v1-pro': 'doubao-seedance-1-0-pro-250528',
        'seedance-2.0': 'doubao-seedance-1-0-pro-250528'
      };
  const targetModel = arkModelMap[model] || model;

  const content = [
    {
      type: 'text',
      text: `${prompt || 'Commercial product video'} --resolution ${resolution} --ratio ${aspectRatio} --duration ${duration}`
    }
  ];

  const primaryImg = imageUrl || referenceImageUrls[0];
  if (primaryImg) {
    content.push({
      type: 'image_url',
      image_url: { url: primaryImg }
    });
  }
  if (endImageUrl) {
    content.push({
      type: 'image_url',
      image_url: { url: endImageUrl },
      role: 'last_frame'
    });
  }

  const createRes = await fetch(`${baseUrl}/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: targetModel,
      content
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Seedance Ark API lỗi (${createRes.status}): ${errText}`);
  }

  const createData = await createRes.json();
  const taskId = createData.id;
  if (!taskId) {
    throw new Error('Seedance Ark API không trả về task ID');
  }

  // Poll trạng thái task đến khi hoàn tất
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const statusRes = await fetch(`${baseUrl}/contents/generations/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const statusData = await statusRes.json();
    if (statusData.status === 'succeeded') {
      return {
        videoUrl: statusData.content?.video_url,
        mode: 'seedance-ark',
        model: targetModel
      };
    }
    if (statusData.status === 'failed' || statusData.status === 'cancelled') {
      throw new Error('Tác vụ Seedance thất bại: ' + JSON.stringify(statusData.error || statusData));
    }
  }

  throw new Error('Hết thời gian chờ kết quả từ Seedance Ark API');
}

exports.generateImage = async (prompt) => {
  if (runtimeConfig.falKey) {
    const r = await fal.subscribe('fal-ai/flux/schnell', { input: { prompt, image_size: 'square_hd' } });
    return r.data.images[0].url;
  }
  const seed = Math.floor(Math.random() * 999999);
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&seed=' + seed + '&nologo=true';
};

exports.inpaintImage = async ({ prompt, imageUrl, maskBase64 }) => {
  if (runtimeConfig.falKey) {
    const r = await fal.subscribe('fal-ai/flux-general/inpainting', {
      input: { prompt, image_url: imageUrl, mask_url: maskBase64 }
    });
    return r.data.images[0].url;
  }
  const seed = Math.floor(Math.random() * 999999);
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ', seamless studio inpaint') + '?width=768&height=768&seed=' + seed + '&nologo=true';
};

exports.removeBackground = async ({ imageUrl }) => {
  if (runtimeConfig.falKey) {
    const r = await fal.subscribe('fal-ai/birefnet', { input: { image_url: imageUrl } });
    return r.data.image.url;
  }
  return imageUrl;
};

exports.generateVideo = async ({
  prompt,
  genMode = 'reference',
  imageUrl,
  endImageUrl,
  referenceImageUrls = [],
  referenceVideoUrl = null,
  model = 'seedance-2.0-mini',
  resolution = '720p',
  aspectRatio = '9:16',
  duration = '5',
  motionType = 'cinematic_zoom'
}) => {
  // 1. Nếu có FAL_KEY -> Gọi trực tiếp ByteDance Seedance trên Fal.ai
  if (runtimeConfig.falKey) {
    fal.config({ credentials: runtimeConfig.falKey });
    const selectedModel = SEEDANCE_ENDPOINTS[model] || SEEDANCE_ENDPOINTS['seedance-2.0-mini'];
    let endpoint = selectedModel.t2v;
    if (genMode === 'reference' && (referenceImageUrls.length > 1 || referenceVideoUrl)) {
      endpoint = selectedModel.ref2v;
    } else if (imageUrl || referenceImageUrls.length === 1) {
      endpoint = selectedModel.i2v;
    }

    const finalPrompt = buildEnglishVideoPrompt(prompt, motionType);
    const input = {
      prompt: finalPrompt,
      resolution,
      aspect_ratio: aspectRatio,
      duration
    };

    if (endpoint.includes('reference-to-video')) {
      if (referenceImageUrls.length > 0) input.image_urls = referenceImageUrls;
      if (referenceVideoUrl) input.video_url = referenceVideoUrl;
    } else {
      const primaryImg = imageUrl || referenceImageUrls[0];
      if (primaryImg) input.image_url = primaryImg;
      if (endImageUrl) input.end_image_url = endImageUrl;
    }

    console.log(`🎬 [Seedance Fal.ai] Đang tạo video thật qua model: ${endpoint}`);
    const r = await fal.subscribe(endpoint, { input, logs: true });
    return {
      videoUrl: r.data?.video?.url,
      mode: 'seedance-fal',
      model,
      endpoint
    };
  }

  // 2. Nếu có ARK_API_KEY -> Gọi trực tiếp ByteDance Volcengine Ark / Trạm API Seedance
  if (runtimeConfig.arkApiKey) {
    return await generateSeedanceViaArk({
      prompt,
      imageUrl,
      endImageUrl,
      referenceImageUrls,
      model,
      resolution,
      aspectRatio,
      duration
    });
  }

  // 3. Mặc định (Chưa nhập Key): Gọi thẳng Cloud GPU AI thật (LTX-Video / Wan 2.2 Diffusion) — KHÔNG giả lập Canvas!
  return await generateRealVideoFreeCloud({
    prompt,
    imageUrl: imageUrl || referenceImageUrls[0],
    endImageUrl,
    aspectRatio,
    duration,
    motionType
  });
};
