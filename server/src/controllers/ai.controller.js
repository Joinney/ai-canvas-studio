const falService = require('../services/fal.service');
const postprocessService = require('../services/postprocess.service');

exports.generate = async (req, res) => {
  try {
    const imageUrl = await falService.generateImage(req.body.prompt || 'Studio product photography');
    res.json({ success: true, imageUrl });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.inpaint = async (req, res) => {
  try {
    const imageUrl = await falService.inpaintImage(req.body);
    res.json({ success: true, imageUrl });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.removeBg = async (req, res) => {
  try {
    const imageUrl = await falService.removeBackground(req.body);
    res.json({ success: true, imageUrl });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.generateVideo = async (req, res) => {
  try {
    const result = await falService.generateVideo(req.body);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.getConfig = (req, res) => {
  res.json({ success: true, ...falService.getConfigStatus() });
};

exports.saveConfig = (req, res) => {
  try {
    const status = falService.updateConfig(req.body || {});
    res.json({ success: true, ...status });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.getFlowSelectors = (req, res) => {
  res.json({ success: true, ...postprocessService.getFlowSelectors() });
};

exports.updateFlowSelectors = (req, res) => {
  try {
    const updated = postprocessService.updateFlowSelectors(req.body.selectors || {});
    res.json({ success: true, ...updated });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.upscaleAndMux = async (req, res) => {
  try {
    const result = await postprocessService.upscaleAndMuxAudio(req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.flowHeartbeat = (req, res) => {
  const data = postprocessService.registerFlowHeartbeat(req.body || {});
  res.json({ success: true, ...data });
};

exports.flowJobResult = (req, res) => {
  const ok = postprocessService.submitBridgeJobResult(req.body || {});
  res.json({ success: ok });
};

exports.flowBridgeStatus = (req, res) => {
  res.json({ success: true, ...postprocessService.getBridgeStatus() });
};

exports.flowBridgeDispatch = async (req, res) => {
  try {
    const { type = 'EXECUTE_FLOW_NODE', payload = {} } = req.body || {};
    const response = await postprocessService.enqueueBridgeJob(type, payload);
    res.json({ success: true, response });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.getProjects = (req, res) => {
  res.json({ success: true, projects: postprocessService.getSavedProjects() });
};

exports.saveProject = (req, res) => {
  try {
    const projects = postprocessService.saveProjectToDisk(req.body || {});
    res.json({ success: true, projects });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.deleteProject = (req, res) => {
  try {
    const projects = postprocessService.deleteProjectFromDisk(req.params.id);
    res.json({ success: true, projects });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.urlToBase64 = async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || url.startsWith('data:')) {
      return res.json({ success: true, base64: url || '' });
    }
    const axios = require('axios');
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 30000 });
    const contentType = response.headers['content-type'] || 'image/png';
    const base64 = `data:${contentType};base64,${Buffer.from(response.data).toString('base64')}`;
    res.json({ success: true, base64 });
  } catch (e) {
    res.json({ success: false, base64: req.body?.url || '', error: e.message });
  }
};

function sanitizeWindowsName(name, fallback = 'Untitled') {
  const cleaned = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return cleaned || fallback;
}

function getOutputProjectFolder(projectTitle, projectId) {
  const rootOutputDir = path.resolve(__dirname, '../../../output');
  const folderName = sanitizeWindowsName(projectTitle || projectId, 'Default_Project');
  return path.join(rootOutputDir, folderName);
}

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

exports.exportNodeOutput = async (req, res) => {
  try {
    const {
      projectTitle = '',
      projectId = '',
      nodeTitle = '',
      nodeId = '',
      nodeType = '',
      stepIndex = 0,
      mediaData = ''
    } = req.body || {};

    if (!mediaData || typeof mediaData !== 'string') {
      return res.status(400).json({ success: false, error: 'Thiếu dữ liệu mediaData để xuất file.' });
    }

    const projectDir = getOutputProjectFolder(projectTitle, projectId);
    fs.mkdirSync(projectDir, { recursive: true });

    let buffer = null;
    let ext = nodeType === 'FLOW_VIDEO_GEN' || nodeType === 'FFMPEG_POST' ? '.mp4' : '.png';

    if (mediaData.startsWith('data:')) {
      const commaIdx = mediaData.indexOf(',');
      const header = commaIdx >= 0 ? mediaData.slice(0, commaIdx) : '';
      const body = commaIdx >= 0 ? mediaData.slice(commaIdx + 1) : mediaData;
      const mimeMatch = header.match(/data:([^;]+)/i);
      const mime = (mimeMatch && mimeMatch[1] || '').toLowerCase();
      if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else if (mime.includes('webp')) ext = '.webp';
      else if (mime.includes('png')) ext = '.png';
      else if (mime.includes('mp4')) ext = '.mp4';
      else if (mime.includes('webm')) ext = '.webm';
      else if (mime.includes('quicktime') || mime.includes('mov')) ext = '.mov';
      buffer = Buffer.from(body, 'base64');
    } else if (/^https?:\/\//i.test(mediaData)) {
      const axios = require('axios');
      const resp = await axios.get(mediaData, { responseType: 'arraybuffer', timeout: 60000 });
      buffer = Buffer.from(resp.data);
      const ct = String(resp.headers['content-type'] || '').toLowerCase();
      if (ct.includes('jpeg') || ct.includes('jpg')) ext = '.jpg';
      else if (ct.includes('webp')) ext = '.webp';
      else if (ct.includes('png')) ext = '.png';
      else if (ct.includes('mp4')) ext = '.mp4';
      else if (ct.includes('webm')) ext = '.webm';
      else {
        const urlExtMatch = mediaData.match(/\.(mp4|webm|mov|png|jpe?g|webp)(\?|$)/i);
        if (urlExtMatch) ext = `.${urlExtMatch[1].toLowerCase() === 'jpeg' ? 'jpg' : urlExtMatch[1].toLowerCase()}`;
      }
    } else if (mediaData.startsWith('/uploads/') || fs.existsSync(mediaData)) {
      const localPath = mediaData.startsWith('/uploads/')
        ? path.resolve(__dirname, '../../', mediaData.replace(/^\/+/, ''))
        : mediaData;
      if (fs.existsSync(localPath)) {
        buffer = fs.readFileSync(localPath);
        ext = path.extname(localPath) || ext;
      }
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ success: false, error: 'Không đọc được nội dung file đầu ra.' });
    }

    const prefix = stepIndex > 0 ? `${String(stepIndex).padStart(2, '0')}_` : '';
    const safeNodeName = sanitizeWindowsName(nodeTitle || nodeId, 'Node_Output');
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `${prefix}${safeNodeName}_${stamp}${ext}`;
    const filePath = path.join(projectDir, fileName);

    fs.writeFileSync(filePath, buffer);
    res.json({ success: true, filePath, folderPath: projectDir, fileName });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};

exports.openOutputFolder = (req, res) => {
  try {
    const { projectTitle = '', projectId = '' } = req.body || {};
    const projectDir = getOutputProjectFolder(projectTitle, projectId);
    fs.mkdirSync(projectDir, { recursive: true });
    if (process.platform === 'win32') {
      execFile('explorer.exe', [projectDir], () => {});
    }
    res.json({ success: true, folderPath: projectDir });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
