const express = require('express');
const router = express.Router();
const c = require('../controllers/ai.controller');

router.post('/generate', c.generate);
router.post('/inpaint', c.inpaint);
router.post('/remove-bg', c.removeBg);
router.post('/generate-video', c.generateVideo);
router.get('/config', c.getConfig);
router.post('/config', c.saveConfig);
router.get('/flow-selectors', c.getFlowSelectors);
router.post('/flow-selectors', c.updateFlowSelectors);
router.post('/upscale-mux', c.upscaleAndMux);
router.post('/flow-bridge/heartbeat', c.flowHeartbeat);
router.post('/flow-bridge/result', c.flowJobResult);
router.get('/flow-bridge/status', c.flowBridgeStatus);
router.post('/flow-bridge/dispatch', c.flowBridgeDispatch);
router.get('/projects', c.getProjects);
router.post('/projects', c.saveProject);
router.delete('/projects/:id', c.deleteProject);
router.post('/url-to-base64', c.urlToBase64);
router.post('/export-output', c.exportNodeOutput);
router.post('/open-output-folder', c.openOutputFolder);

module.exports = router;
