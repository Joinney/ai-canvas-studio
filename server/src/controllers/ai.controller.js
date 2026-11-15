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
