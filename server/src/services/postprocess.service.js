const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const axios = require('axios');

// Thư mục lưu trữ Dự án (Projects) cố định trên ổ cứng máy tính
const DATA_DIR = path.join(__dirname, '../../data');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROJECTS_FILE)) {
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

exports.getSavedProjects = () => {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
};

exports.saveProjectToDisk = (project) => {
  ensureDataFile();
  const list = exports.getSavedProjects();
  const idx = list.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    list[idx] = project;
  } else {
    list.unshift(project);
  }
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  return list;
};

exports.deleteProjectFromDisk = (projectId) => {
  ensureDataFile();
  const list = exports.getSavedProjects().filter((p) => p.id !== projectId);
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify(list, null, 2), 'utf8');
  return list;
};

// Danh sách CSS Selector động cho Google Flow (Bài toán 4: Chống gãy DOM khi Google đổi UI)
let flowSelectors = {
  version: '2026.10.1',
  updatedAt: new Date().toISOString(),
  selectors: {
    fileInput: 'input[type="file"]',
    dropZone: '[data-testid*="drop"], [aria-label*="Upload"], [aria-label*="Tải lên"], form, main',
    promptInput: 'textarea, [contenteditable="true"][role="textbox"], div[contenteditable="true"]',
    generateBtn: 'button[type="submit"], button[aria-label*="Generate"], button[aria-label*="Tạo"], button[aria-label*="Create"], button[aria-label*="Gửi"]',
    resultMedia: 'video[src^="blob:"], video[src^="https://"], img[src^="blob:https://labs.google"], img[src*="googleusercontent.com"]'
  }
};

// Cầu nối Relay trực tiếp giữa Web Canvas (5173) <-> Backend (5001) <-> Tab Google Flow
const activeFlowClients = new Map(); // clientId -> { lastSeen, url, title }
const pendingBridgeJobs = []; // [{ jobId, type, payload, resolve, reject }]

exports.registerFlowHeartbeat = ({ clientId = 'default-flow-tab', url = '', title = '' } = {}) => {
  activeFlowClients.set(clientId, {
    clientId,
    url,
    title,
    lastSeen: Date.now()
  });
  // Xóa các tab quá 15 giây không gửi heartbeat
  for (const [id, info] of activeFlowClients.entries()) {
    if (Date.now() - info.lastSeen > 15000) activeFlowClients.delete(id);
  }
  const nextJob = pendingBridgeJobs.shift() || null;
  return {
    connectedTabs: activeFlowClients.size,
    job: nextJob ? { jobId: nextJob.jobId, type: nextJob.type, payload: nextJob.payload } : null
  };
};

exports.submitBridgeJobResult = ({ jobId, response }) => {
  if (global.__flowBridgeResolvers && global.__flowBridgeResolvers.has(jobId)) {
    const { resolve, timer } = global.__flowBridgeResolvers.get(jobId);
    clearTimeout(timer);
    global.__flowBridgeResolvers.delete(jobId);
    resolve(response);
    return true;
  }
  return false;
};

exports.getBridgeStatus = () => {
  for (const [id, info] of activeFlowClients.entries()) {
    if (Date.now() - info.lastSeen > 15000) activeFlowClients.delete(id);
  }
  return {
    connected: activeFlowClients.size > 0,
    openFlowTabs: activeFlowClients.size,
    maxConcurrentTabs: 3,
    tabs: Array.from(activeFlowClients.values())
  };
};

exports.enqueueBridgeJob = (type, payload, timeoutMs = 130000) => {
  if (!global.__flowBridgeResolvers) global.__flowBridgeResolvers = new Map();
  return new Promise((resolve, reject) => {
    const jobId = 'srv-job-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const timer = setTimeout(() => {
      global.__flowBridgeResolvers.delete(jobId);
      reject(new Error('Tab Google Flow không phản hồi kịp thời gian chờ.'));
    }, timeoutMs);

    global.__flowBridgeResolvers.set(jobId, { resolve, reject, timer });
    pendingBridgeJobs.push({ jobId, type, payload });
  });
};

exports.getFlowSelectors = () => flowSelectors;

exports.updateFlowSelectors = (newSelectors = {}) => {
  flowSelectors = {
    version: '2026.10.' + Date.now(),
    updatedAt: new Date().toISOString(),
    selectors: {
      ...flowSelectors.selectors,
      ...newSelectors
    }
  };
  return flowSelectors;
};

// Lưu Base64 hoặc URL về file tạm để FFmpeg xử lý
async function saveMediaToFile(mediaSource, outputPath) {
  if (mediaSource.startsWith('data:')) {
    const base64Body = mediaSource.split(',')[1];
    fs.writeFileSync(outputPath, Buffer.from(base64Body, 'base64'));
    return outputPath;
  }
  const res = await axios.get(mediaSource, { responseType: 'arraybuffer', timeout: 60000 });
  fs.writeFileSync(outputPath, Buffer.from(res.data));
  return outputPath;
}

/**
 * NODE THỨ 4 (CỘT 4): Tự động Upscale Video 480p -> 1080p HD (Lanczos + Unsharp) & Ghép nhạc nền bằng FFmpeg
 */
exports.upscaleAndMuxAudio = async ({
  videoSource,
  audioSource,
  targetResolution = '1080x1920',
  audioVolume = 0.85
}) => {
  if (!videoSource) {
    throw new Error('Thiếu video đầu vào (videoSource) từ Node Cột 3!');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flow-node4-'));
  const inputVideoPath = path.join(tmpDir, 'input_480p.mp4');
  const inputAudioPath = path.join(tmpDir, 'bgm.mp3');
  const outputVideoPath = path.join(tmpDir, 'output_1080p_muxed.mp4');

  try {
    await saveMediaToFile(videoSource, inputVideoPath);
    const hasAudio = Boolean(audioSource);
    if (hasAudio) {
      await saveMediaToFile(audioSource, inputAudioPath);
    }

    const [width, height] = targetResolution.split('x').map((n) => parseInt(n, 10) || 1080);
    // Bộ lọc Upscale Lanczos + làm sắc nét cạnh (Unsharp Mask) giúp video 480p lên 1080p căng nét
    const vfFilter = `scale=${width}:${height}:flags=lanczos,unsharp=5:5:0.8:3:3:0.4`;

    const ffmpegArgs = ['-y', '-i', inputVideoPath];
    if (hasAudio) {
      ffmpegArgs.push('-stream_loop', '-1', '-i', inputAudioPath);
    }

    ffmpegArgs.push('-vf', vfFilter);

    if (hasAudio) {
      ffmpegArgs.push(
        '-filter_complex',
        `[1:a]volume=${Number(audioVolume) || 0.85}[bgm]`,
        '-map',
        '0:v:0',
        '-map',
        '[bgm]',
        '-shortest',
        '-c:a',
        'aac',
        '-b:a',
        '192k'
      );
    } else {
      ffmpegArgs.push('-c:a', 'copy');
    }

    ffmpegArgs.push(
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputVideoPath
    );

    await new Promise((resolve, reject) => {
      const ff = spawn('ffmpeg', ffmpegArgs);
      let stderrLog = '';
      ff.stderr.on('data', (chunk) => {
        stderrLog += chunk.toString();
      });
      ff.on('error', (err) => {
        reject(new Error('FFMPEG_NOT_FOUND:' + err.message));
      });
      ff.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputVideoPath)) {
          resolve();
        } else {
          reject(new Error(`FFmpeg thoát với mã lỗi ${code}: ${stderrLog.slice(-300)}`));
        }
      });
    });

    const outBuffer = fs.readFileSync(outputVideoPath);
    const base64Video = `data:video/mp4;base64,${outBuffer.toString('base64')}`;

    return {
      videoUrl: base64Video,
      resolution: `${width}x${height}`,
      audioMuxed: hasAudio,
      upscaled: true
    };
  } catch (err) {
    // Nếu máy Windows của người dùng chưa cài đặt FFmpeg trong PATH, tự động trả về nguyên vẹn video từ Cột 3 để không bị đứt luồng
    console.warn('⚠️ [Node 4 FFmpeg] Chưa cài FFmpeg hoặc lỗi hậu kỳ, trả về video gốc:', err.message);
    return {
      videoUrl: videoSource,
      resolution: 'Original (Google Flow)',
      audioMuxed: false,
      upscaled: false,
      warning: err.message
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
