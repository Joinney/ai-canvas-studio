import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Image as ImageIcon,
  Video,
  Sparkles,
  Upload,
  Trash2,
  Loader2,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Plus,
  CheckCircle2,
  Link2,
  StickyNote,
  FileJson
} from 'lucide-react';
import axios from 'axios';
import { executeGoogleFlowNode, getFlowPoolStatus, resetFlowWorkers } from '../services/flowBridge';
import { convertDaAiCanvasToProject } from '../utils/daCanvasConverter';

const api = axios.create({ baseURL: 'http://localhost:5001/api/ai' });

const NODE_WIDTH = 310;
const PORT_OFFSET_Y = 92; // Vị trí tâm cổng Input/Output tính từ đỉnh Node

const NODE_TYPES_META = {
  IMAGE_INPUT: {
    label: 'Cột 1: Ảnh Đầu Vào',
    badgeClass: 'bg-sky-500/15 text-sky-700 border-sky-500/35',
    headerAccent: 'border-t-4 border-t-sky-500',
    hasInput: false,
    hasOutput: true
  },
  FLOW_IMAGE_GEN: {
    label: 'Cột 2: Tạo Ảnh (Muse / Flow)',
    badgeClass: 'bg-cyan-500/15 text-cyan-800 border-cyan-500/35',
    headerAccent: 'border-t-4 border-t-cyan-500',
    hasInput: true,
    hasOutput: true
  },
  FLOW_VIDEO_GEN: {
    label: 'Cột 3: Tạo Video (Muse / Veo 2)',
    badgeClass: 'bg-teal-500/15 text-teal-800 border-teal-500/35',
    headerAccent: 'border-t-4 border-t-teal-500',
    hasInput: true,
    hasOutput: true
  },
  FFMPEG_POST: {
    label: 'Cột 4: Upscale HD & Ghép Nhạc',
    badgeClass: 'bg-emerald-500/15 text-emerald-800 border-emerald-500/35',
    headerAccent: 'border-t-4 border-t-emerald-500',
    hasInput: true,
    hasOutput: false
  }
};

const isVideoMedia = (url, nodeType) =>
  typeof url === 'string' &&
  !url.startsWith('data:image/') &&
  !/\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) &&
  (url.startsWith('data:video/') ||
    /\.(mp4|webm|mov|mkv)(\?|$)/i.test(url) ||
    (nodeType === 'FLOW_VIDEO_GEN' && (url.startsWith('http://') || url.startsWith('https://'))));

export default function WorkflowNodeCanvas({ project, onSaveProject }) {
  const [nodes, setNodes] = useState(() => project?.nodes || []);
  const [edges, setEdges] = useState(() => project?.edges || []);
  const [stickers, setStickers] = useState(() => project?.stickers || []);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [zoom, setZoom] = useState(() => ((project?.nodes?.length || 0) > 5 ? 0.45 : 0.92));
  const [isPanning, setIsPanning] = useState(false);

  // Dùng ref cho quá trình kéo để đạt 120 FPS mượt tuyệt đối, không bị re-render thừa
  const panRef = useRef(pan);
  panRef.current = pan;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const panStartRef = useRef({ x: 0, y: 0 });
  const draggingNodeRef = useRef(null); // { nodeId, startMouseX, startMouseY, startNodeX, startNodeY }
  const draggingStickerRef = useRef(null); // { stickerId, startMouseX, startMouseY, startX, startY }

  // Kéo dây nối hoặc Click-to-Connect
  const [connectingFromNodeId, setConnectingFromNodeId] = useState(null);
  const [hoveredTargetNodeId, setHoveredTargetNodeId] = useState(null);
  const [mouseCanvasPos, setMouseCanvasPos] = useState({ x: 0, y: 0 });

  const [isRunningAll, setIsRunningAll] = useState(false);
  const [statusBanner, setStatusBanner] = useState('');

  const containerRef = useRef(null);
  const saveTimerRef = useRef(null);
  const isCancelledRef = useRef(false);

  const handleStopWorkflow = () => {
    isCancelledRef.current = true;
    resetFlowWorkers();
    setIsRunningAll(false);
    setSelectedNodeId(null);
    setStatusBanner('⏹️ Đã dừng tiến trình! Các kết quả đã tạo vẫn được giữ nguyên (bấm Chạy để chạy lại từ đầu).');
    setNodes((prev) =>
      prev.map((n) => {
        if (n.type === 'IMAGE_INPUT') {
          return { ...n, data: { ...n.data, status: 'done', error: null } };
        }
        // Giữ nguyên kết quả đã tạo (resultUrl) của các Node đã xong; chỉ dừng Node đang chạy về idle
        const hasResult = Boolean(n.data?.resultUrl);
        return {
          ...n,
          data: {
            ...n.data,
            status: hasResult ? 'done' : 'idle',
            error: null
          }
        };
      })
    );
  };

  // Nhật ký hoạt động trực tiếp (Logs) nhận từ Web Canvas và tab Muse AI chạy ngầm
  const [bridgeLogs, setBridgeLogs] = useState([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      source: 'Canvas',
      text: 'Sẵn sàng chạy Workflow ngầm với Muse AI / Google Flow',
      level: 'success'
    }
  ]);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);

  const pushWorkflowLog = useCallback((text, level = 'info', source = 'Canvas', externalId = null, externalTime = null) => {
    if (!text) return;
    const entry = {
      id: externalId || `canvas-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      time: externalTime || new Date().toLocaleTimeString('vi-VN', { hour12: false }),
      source,
      text,
      level
    };
    setBridgeLogs((prev) => {
      if (externalId && prev.some((item) => item.id === externalId)) return prev;
      const last = prev[prev.length - 1];
      if (last && last.text === text && last.source === source) return prev;
      const next = [...prev, entry];
      return next.length > 80 ? next.slice(next.length - 80) : next;
    });
    if (source === 'Canvas' && window.parent !== window) {
      try {
        window.parent.postMessage({ source: 'AI_CANVAS_WEB', type: 'CANVAS_LOG_EVENT', log: entry }, '*');
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const onExtLog = (event) => {
      if (event.data?.source === 'AI_CANVAS_EXTENSION' && event.data?.type === 'BRIDGE_LOG_EVENT' && event.data?.log) {
        const l = event.data.log;
        pushWorkflowLog(l.text, l.level || 'info', l.source || 'Muse AI', l.id || null, l.time || null);
      }
    };
    window.addEventListener('message', onExtLog);
    return () => window.removeEventListener('message', onExtLog);
  }, [pushWorkflowLog]);

  useEffect(() => {
    if (!statusBanner) return;
    const lvl =
      statusBanner.includes('❌') || statusBanner.includes('Lỗi')
        ? 'error'
        : statusBanner.includes('✅') || statusBanner.includes('Hoàn tất')
        ? 'success'
        : statusBanner.includes('⚠️') || statusBanner.includes('⏹️')
        ? 'warn'
        : 'info';
    pushWorkflowLog(statusBanner, lvl, 'Canvas');
  }, [statusBanner, pushWorkflowLog]);

  // Debounce lưu dự án (chỉ lưu sau khi người dùng ngừng kéo 600ms để không bao giờ gây giật lag)
  useEffect(() => {
    if (!onSaveProject) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSaveProject({ ...project, nodes, edges, stickers, updatedAt: new Date().toISOString() });
    }, 600);
    return () => clearTimeout(saveTimerRef.current);
  }, [nodes, edges, stickers]);

  const handleAddSticker = () => {
    const newSticker = {
      id: 'sticker-' + Date.now(),
      x: Math.round((-panRef.current.x + 180) / zoomRef.current),
      y: Math.round((-panRef.current.y + 120) / zoomRef.current),
      width: 280,
      height: 130,
      title: '便签 • Ghi chú Workflow',
      html: '<p>Nhập ghi chú hướng dẫn cho Cột / Node tại đây...</p>'
    };
    setStickers((prev) => [...prev, newSticker]);
  };

  const handleImportDaCanvasJson = () => {
    const rawText = window.prompt(
      'Dán nội dung JSON định dạng {"__canvas": "da-ai-canvas", "nodes": [...], "edges": [...]} vào đây:'
    );
    if (!rawText || !rawText.trim()) return;
    try {
      const parsed = JSON.parse(rawText);
      const converted = convertDaAiCanvasToProject(parsed);
      setNodes(converted.nodes);
      setEdges(converted.edges);
      setStickers(converted.stickers || []);
      setZoom(0.45);
      setPan({ x: 50, y: 30 });
      setStatusBanner('✅ Đã nạp thành công dự án da-ai-canvas (' + converted.nodes.length + ' Nodes)!');
      setTimeout(() => setStatusBanner(''), 4000);
    } catch (err) {
      alert('Lỗi đọc JSON: ' + err.message);
    }
  };

  const screenToCanvas = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top - panRef.current.y) / zoomRef.current
    };
  }, []);

  // Thêm Node mới và tự động nối dây từ Node đang chọn (nếu hợp lệ)
  const handleAddNode = (type) => {
    const id = 'node-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5);
    const defaultDataByType = {
      IMAGE_INPUT: {
        title: `Ảnh đầu vào #${nodes.filter((n) => n.type === 'IMAGE_INPUT').length + 1}`,
        imageUrl: '',
        status: 'idle'
      },
      FLOW_IMAGE_GEN: {
        title: 'Tạo Ảnh 3 Góc Độ (Imagen 3)',
        prompt:
          'Full body 3-angle fashion lookbook (front, side, back) wearing this outfit, clean studio background, commercial fashion photography',
        resultUrl: '',
        status: 'idle'
      },
      FLOW_VIDEO_GEN: {
        title: 'Tạo Video Runway (Veo 2)',
        prompt: 'Fashion model walking confidently on studio runway, smooth camera motion, 9:16 vertical video',
        aspectRatio: '9:16',
        resolution: '480p',
        resultUrl: '',
        status: 'idle'
      },
      FFMPEG_POST: {
        title: 'Upscale 1080p & Ghép Nhạc',
        bgmUrl: '',
        targetResolution: '1080x1920',
        resultUrl: '',
        status: 'idle'
      }
    };

    const sameTypeNodes = nodes.filter((n) => n.type === type);
    const colXMap = {
      IMAGE_INPUT: 60,
      FLOW_IMAGE_GEN: 450,
      FLOW_VIDEO_GEN: 840,
      FFMPEG_POST: 1230
    };

    const newNode = {
      id,
      type,
      x: colXMap[type] ?? 300,
      y: 60 + sameTypeNodes.length * 340,
      data: defaultDataByType[type]
    };

    setNodes((prev) => [...prev, newNode]);

    // Nếu đang chọn 1 Node có cổng Output và thêm Node mới có cổng Input -> Tự động nối dây luôn cho tiện!
    if (selectedNodeId && NODE_TYPES_META[type]?.hasInput) {
      const selNode = nodes.find((n) => n.id === selectedNodeId);
      if (selNode && NODE_TYPES_META[selNode.type]?.hasOutput) {
        setEdges((prev) => [
          ...prev,
          { id: `e-${selNode.id}-${id}`, source: selNode.id, target: id }
        ]);
      }
    }

    setSelectedNodeId(id);
  };

  const updateNodeData = (nodeId, partialData) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...partialData } } : n))
    );
  };

  const handleDeleteNode = (nodeId) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleDeleteEdge = (edgeId) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  // Kết nối 2 Node
  const connectTwoNodes = (sourceId, targetId) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const srcNode = nodes.find((n) => n.id === sourceId);
    const tgtNode = nodes.find((n) => n.id === targetId);
    if (!srcNode || !tgtNode) return;
    if (!NODE_TYPES_META[srcNode.type]?.hasOutput || !NODE_TYPES_META[tgtNode.type]?.hasInput) return;

    setEdges((prev) => {
      if (prev.some((e) => e.source === sourceId && e.target === targetId)) return prev;
      return [...prev, { id: `edge-${sourceId}-${targetId}-${Date.now()}`, source: sourceId, target: targetId }];
    });
  };

  // Bắt sự kiện kéo bàn vẽ (Pan) khi bấm vào vùng trống
  const handleCanvasMouseDown = (e) => {
    // Nếu bấm vào phần tử không nằm trong thẻ .workflow-node-card hoặc .workflow-sticker-card thì bắt đầu Pan bàn vẽ
    if (
      !e.target.closest('.workflow-node-card') &&
      !e.target.closest('.workflow-sticker-card') &&
      !e.target.closest('.edge-delete-btn')
    ) {
      setSelectedNodeId(null);
      setConnectingFromNodeId(null);
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - panRef.current.x,
        y: e.clientY - panRef.current.y
      };
    }
  };

  // Lắng nghe di chuyển chuột trên toàn window để kéo Node / Sticker / Pan không bao giờ bị tuột chuột
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      if (isPanning) {
        setPan({
          x: e.clientX - panStartRef.current.x,
          y: e.clientY - panStartRef.current.y
        });
        return;
      }

      if (draggingNodeRef.current) {
        const { nodeId, startMouseX, startMouseY, startNodeX, startNodeY } = draggingNodeRef.current;
        const dx = (e.clientX - startMouseX) / zoomRef.current;
        const dy = (e.clientY - startMouseY) / zoomRef.current;
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...n, x: Math.round(startNodeX + dx), y: Math.round(startNodeY + dy) }
              : n
          )
        );
        return;
      }

      if (draggingStickerRef.current) {
        const { stickerId, startMouseX, startMouseY, startX, startY } = draggingStickerRef.current;
        const dx = (e.clientX - startMouseX) / zoomRef.current;
        const dy = (e.clientY - startMouseY) / zoomRef.current;
        setStickers((prev) =>
          prev.map((s) =>
            s.id === stickerId
              ? { ...s, x: Math.round(startX + dx), y: Math.round(startY + dy) }
              : s
          )
        );
        return;
      }

      if (connectingFromNodeId) {
        setMouseCanvasPos(screenToCanvas(e.clientX, e.clientY));
      }
    };

    const handleGlobalMouseUp = () => {
      if (isPanning) setIsPanning(false);
      if (draggingNodeRef.current) draggingNodeRef.current = null;
      if (draggingStickerRef.current) draggingStickerRef.current = null;
      if (connectingFromNodeId) {
        if (hoveredTargetNodeId && hoveredTargetNodeId !== connectingFromNodeId) {
          connectTwoNodes(connectingFromNodeId, hoveredTargetNodeId);
        }
        setConnectingFromNodeId(null);
        setHoveredTargetNodeId(null);
      }
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isPanning, connectingFromNodeId, hoveredTargetNodeId, nodes, screenToCanvas]);

  // Lăn chuột Zoom mượt ngay tại vị trí con trỏ chuột (không cần giữ Ctrl)
  const handleWheel = (e) => {
    // Nếu đang lăn chuột bên trong ô nhập chữ (textarea) có thanh cuộn thì không zoom
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    e.preventDefault();

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldZoom = zoomRef.current;
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.35, Math.min(1.65, Number((oldZoom * factor).toFixed(3))));

    const newPanX = mouseX - ((mouseX - panRef.current.x) / oldZoom) * newZoom;
    const newPanY = mouseY - ((mouseY - panRef.current.y) / oldZoom) * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleUploadToNode = (nodeId, file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawDataUrl = ev.target.result;
      const img = new Image();
      img.onload = () => {
        let finalDataUrl = rawDataUrl;
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
          finalDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        } catch (err) {
          finalDataUrl = rawDataUrl;
        }

        // Tìm các Node phụ thuộc (Cột 2, Cột 3, Cột 4) nối từ Node đầu vào này để xóa ngay ảnh mẫu cũ
        const downstreamIds = new Set();
        const queue = [nodeId];
        while (queue.length > 0) {
          const curr = queue.shift();
          for (const e of edges) {
            if (e.source === curr && !downstreamIds.has(e.target)) {
              downstreamIds.add(e.target);
              queue.push(e.target);
            }
          }
        }

        setNodes((prev) =>
          prev.map((n) => {
            if (n.id === nodeId) {
              return { ...n, data: { ...n.data, imageUrl: finalDataUrl, status: 'done', error: null } };
            }
            if (downstreamIds.has(n.id) && n.type !== 'IMAGE_INPUT') {
              return { ...n, data: { ...n.data, resultUrl: '', status: 'idle', error: null } };
            }
            return n;
          })
        );
        setStatusBanner('✅ Đã cập nhật ảnh đầu vào mới ở Cột 1 và làm sạch ảnh cũ ở các nhánh phụ thuộc!');
        setTimeout(() => setStatusBanner(''), 3500);
      };
      img.onerror = () => {
        updateNodeData(nodeId, { imageUrl: rawDataUrl, status: 'done' });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Thực thi 1 Node: Luôn lấy đúng danh sách ảnh đầu vào (inputMediaList) từ các Node nguồn
  // và đẩy trực tiếp lệnh sang tab Google Flow (Tuyệt đối KHÔNG lấy lại ảnh cũ có sẵn)!
  const runNodeWithSmartFallback = async (node, inputMediaList = [], usedOutputsSet = new Set()) => {
    if (node.type === 'FLOW_IMAGE_GEN') {
      if (!inputMediaList || inputMediaList.length === 0) {
        throw new Error(`Node "${node.data.title}" chưa nhận được ảnh đầu vào từ Cột 1!`);
      }

      const res = await executeGoogleFlowNode({
        mode: 'IMAGE',
        images: inputMediaList,
        prompt: node.data.prompt
      });
      const out = res?.base64 || res?.rawUrl;
      if (!out) {
        throw new Error(`Google Flow không trả về ảnh cho Node "${node.data.title}".`);
      }
      // Tuyệt đối không nhận lại ảnh bị trùng với bất kỳ ảnh đầu vào nào (Ảnh Mẫu hay Trang Phục)
      if (inputMediaList.includes(out) || usedOutputsSet.has(out)) {
        throw new Error(
          `Ảnh nhận về bị trùng với ảnh đầu vào hoặc nhánh trước cho "${node.data.title}". Hãy bấm chạy lại Node này!`
        );
      }
      return out;
    }

    if (node.type === 'FLOW_VIDEO_GEN') {
      if (!inputMediaList || inputMediaList.length === 0) {
        throw new Error(`Node Video "${node.data.title}" chưa có ảnh đầu vào từ Cột 2!`);
      }

      const res = await executeGoogleFlowNode({
        mode: 'VIDEO',
        aspectRatio: node.data.aspectRatio || '9:16',
        resolution: node.data.resolution || '480p',
        images: inputMediaList,
        prompt: node.data.prompt
      });
      const out = res?.base64 || res?.rawUrl;
      if (!out) {
        throw new Error(
          `Muse AI / Google Flow không trả về video cho "${node.data.title}". Hãy kiểm tra lại tab tạo Video!`
        );
      }
      if (inputMediaList.includes(out) || usedOutputsSet.has(out)) {
        throw new Error(
          `Kết quả nhận về bị trùng với ảnh đầu vào hoặc output cũ cho "${node.data.title}". Muse AI chưa hoàn tất sinh Video mới!`
        );
      }
      return out;
    }

    if (node.type === 'FFMPEG_POST') {
      const videoInput = inputMediaList[0];
      if (!videoInput) {
        throw new Error(`Node "${node.data.title}" chưa có video đầu vào từ Cột 3!`);
      }
      const { data } = await api.post('/upscale-mux', {
        videoSource: videoInput,
        audioSource: node.data.bgmUrl || null,
        targetResolution: node.data.targetResolution || '1080x1920'
      });
      return data?.videoUrl || videoInput;
    }

    return '';
  };

  const executeSingleNode = async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return null;

    if (node.type === 'IMAGE_INPUT') {
      if (!node.data.imageUrl) {
        throw new Error(`Node "${node.data.title}" chưa có ảnh đầu vào! Hãy bấm tải ảnh lên.`);
      }
      return node.data.imageUrl;
    }

    const incomingEdges = edges.filter((e) => e.target === nodeId);
    const sourceNodeObjs = incomingEdges
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter(Boolean);

    // Chuẩn hóa thứ tự ảnh đầu vào cho Cột 2:
    // Ảnh 1 (@Image 1): Luôn là Ảnh Mẫu (dùng chung cho các nhánh hoặc có chữ "mẫu"/"model" hoặc node-0 / node-4)
    // Ảnh 2 (@Image 2): Luôn là Ảnh Trang Phục (riêng của từng nhánh)
    let inputMediaList = [];
    if (node.type === 'FLOW_IMAGE_GEN' && sourceNodeObjs.length >= 2) {
      const isModelNode = (n) =>
        /mẫu|model|三视图|gốc/i.test(n.data?.title || '') ||
        String(n.id).endsWith('-0') ||
        String(n.id).endsWith('-4') ||
        n.y === Math.min(...sourceNodeObjs.map((s) => s.y));

      const modelNodes = sourceNodeObjs.filter(isModelNode);
      const outfitNodes = sourceNodeObjs.filter((n) => !isModelNode(n));
      const sortedObjs = [...modelNodes, ...outfitNodes];
      inputMediaList = sortedObjs
        .map((sn) => (sn.type === 'IMAGE_INPUT' ? sn.data.imageUrl : sn.data.resultUrl || sn.data.fallbackUrl))
        .filter(Boolean);
    } else {
      inputMediaList = sourceNodeObjs
        .map((sn) => (sn.type === 'IMAGE_INPUT' ? sn.data.imageUrl : sn.data.resultUrl || sn.data.fallbackUrl))
        .filter(Boolean);
    }

    // Giải phóng hàng đợi Worker cũ (nếu có) và xóa ảnh cũ trên Node trước khi chạy
    resetFlowWorkers();
    updateNodeData(nodeId, { resultUrl: '', status: 'running', error: null });
    setSelectedNodeId(nodeId);
    setStatusBanner(`⚡ Đang gửi ${inputMediaList.length} ảnh đầu vào của "${node.data.title}" sang Google Flow...`);

    try {
      const outputUrl = await runNodeWithSmartFallback(node, inputMediaList, new Set());
      updateNodeData(nodeId, { resultUrl: outputUrl, status: 'done', error: null });
      autoExportNodeResultToDisk(node, outputUrl, 0);
      setStatusBanner(`✅ Hoàn tất Node "${node.data.title}" từ ảnh đầu vào mới!`);
      setTimeout(() => setStatusBanner(''), 3500);
      return outputUrl;
    } catch (err) {
      updateNodeData(nodeId, { status: 'error', error: err.message });
      setStatusBanner(`❌ Lỗi tại "${node.data.title}": ${err.message}`);
      throw err;
    }
  };

  const autoExportNodeResultToDisk = useCallback(
    async (node, outUrl, stepIndex = 0) => {
      if (!outUrl || !node) return;
      try {
        const { data } = await api.post('/export-output', {
          projectTitle: project?.title || project?.name || 'Untitled Project',
          projectId: project?.id || '',
          nodeTitle: node?.data?.title || node?.id,
          nodeId: node?.id,
          nodeType: node?.type,
          stepIndex,
          mediaData: outUrl
        });
        if (data?.success && data?.filePath) {
          pushWorkflowLog(`💾 Đã tự động xuất file: ${data.filePath}`, 'success', 'Export');
        }
      } catch (err) {
        pushWorkflowLog(`⚠️ Không thể tự động lưu file ra thư mục output: ${err.message}`, 'warn', 'Export');
      }
    },
    [project?.id, project?.title, project?.name, pushWorkflowLog]
  );

  const handleRunFullWorkflow = async () => {
    isCancelledRef.current = false;
    resetFlowWorkers();
    setIsRunningAll(true);
    setStatusBanner('🚀 Bắt đầu chạy Workflow theo đúng sơ đồ dây nối (DAG)...');

    try {
      // 1. Chuẩn bị danh sách Node: giữ nguyên fallbackUrl, reset status các node cần sinh
      const preparedNodes = nodes.map((n) => {
        const savedFallback = n.data?.fallbackUrl || n.data?.resultUrl || '';
        if (n.type === 'IMAGE_INPUT') {
          return {
            ...n,
            data: { ...n.data, status: 'done', error: null }
          };
        }
        return {
          ...n,
          data: {
            ...n.data,
            fallbackUrl: savedFallback,
            resultUrl: '',
            status: 'idle',
            error: null
          }
        };
      });
      setNodes(preparedNodes);

      const runtimeOutputs = {};
      const usedOutputsSet = new Set();

      // Nạp toàn bộ các node nguồn (IMAGE_INPUT) vào runtimeOutputs
      for (const n of preparedNodes) {
        if (n.type === 'IMAGE_INPUT' && n.data?.imageUrl) {
          runtimeOutputs[n.id] = n.data.imageUrl;
          usedOutputsSet.add(n.data.imageUrl);
        }
      }

      // 2. Thuật toán Sắp xếp Tô-pô (Topological Sort / DAG) theo đúng từng dây nối (edges):
      // Một Node CHỈ ĐƯỢC CHẠY khi TẤT CẢ các Node nguồn trỏ dây vào nó đã chạy xong và có kết quả!
      const adjList = {};
      const executableNodes = preparedNodes.filter((n) => n.type !== 'IMAGE_INPUT');

      for (const n of preparedNodes) {
        adjList[n.id] = [];
      }

      for (const edge of edges) {
        if (adjList[edge.source]) {
          adjList[edge.source].push(edge.target);
        }
      }

      // Hàm lấy danh sách ảnh/video đầu vào cho 1 Node theo đúng đường dây nối (edges):
      // QUY TẮC BẮT BUỘC: Chỉ lấy ảnh MỚI NHẤT vừa sinh từ Node nguồn (runtimeOutputs),
      // TUYỆT ĐỐI KHÔNG dùng lại ảnh cũ (fallbackUrl)! Nếu node nguồn chưa có kết quả -> báo lỗi và dừng ngay.
      const getInputsForNode = (targetId) => {
        const targetNode = preparedNodes.find((pn) => pn.id === targetId);
        const incomingEdges = edges.filter((e) => e.target === targetId);
        const sourceNodeObjs = incomingEdges
          .map((e) => preparedNodes.find((pn) => pn.id === e.source))
          .filter(Boolean);

        if (sourceNodeObjs.length === 0) {
          throw new Error(`Node "${targetNode?.data?.title}" chưa được nối dây với bất kỳ node nguồn nào!`);
        }

        // BẮT BUỘC: Mọi node nguồn nối vào node này PHẢI ĐÃ HOÀN THÀNH và có kết quả thật trong runtimeOutputs
        for (const sn of sourceNodeObjs) {
          const val = runtimeOutputs[sn.id];
          if (!val) {
            throw new Error(
              `Node "${targetNode?.data?.title}" chưa thể chạy vì node nguồn "${sn.data?.title}" chưa có kết quả trả về từ Muse AI!`
            );
          }
        }

        if (targetNode?.type === 'FLOW_IMAGE_GEN' && sourceNodeObjs.length >= 2) {
          const isModelNode = (n) =>
            /mẫu|model|三视图|gốc/i.test(n.data?.title || '') ||
            String(n.id).endsWith('-0') ||
            String(n.id).endsWith('-4') ||
            (n.y || 0) <= Math.min(...sourceNodeObjs.map((s) => s.y || 0));

          const modelNodes = sourceNodeObjs.filter(isModelNode);
          const outfitNodes = sourceNodeObjs.filter((n) => !isModelNode(n));
          const sortedObjs = [...modelNodes, ...outfitNodes];
          return sortedObjs.map((sn) => runtimeOutputs[sn.id]).filter(Boolean);
        }

        return sourceNodeObjs.map((sn) => runtimeOutputs[sn.id]).filter(Boolean);
      };

      // Hàng đợi các Node đã sẵn sàng (đã có đủ toàn bộ đầu vào từ các node trước đó)
      const executionQueue = [];
      for (const n of executableNodes) {
        // Kiểm tra xem tất cả các node nguồn trỏ vào n đã hoàn tất chưa
        const incomingEdges = edges.filter((e) => e.target === n.id);
        const allSourcesDone = incomingEdges.every((e) => Boolean(runtimeOutputs[e.source]));
        if (allSourcesDone) {
          executionQueue.push(n.id);
        }
      }

      // Sắp xếp queue ban đầu theo trục Y từ trên xuống để chọn nhánh đầu tiên (Nhánh 1 trước, Nhánh 2 sau)
      executionQueue.sort((a, b) => {
        const na = preparedNodes.find((n) => n.id === a);
        const nb = preparedNodes.find((n) => n.id === b);
        return (na?.y || 0) - (nb?.y || 0);
      });

      const executedSet = new Set();
      let stepIndex = 1;
      const totalSteps = executableNodes.length;

      while (executionQueue.length > 0) {
        if (isCancelledRef.current) break;

        const currentId = executionQueue.shift();
        if (executedSet.has(currentId)) continue;

        const node = preparedNodes.find((n) => n.id === currentId);
        if (!node) continue;

        const inputs = getInputsForNode(node.id);
        setSelectedNodeId(node.id);
        setStatusBanner(
          `⚡ [Bước ${stepIndex}/${totalSteps}] Đang chờ Muse AI hoàn tất: "${node.data.title}" (${inputs.length} dữ liệu đầu vào)... Đợi có kết quả nạp vào bàn vẽ mới chuyển bước tiếp theo!`
        );
        updateNodeData(node.id, { status: 'running', error: null });

        try {
          // Chạy node và CHỜ 100% CÓ KẾT QUẢ TRẢ VỀ
          const outUrl = await runNodeWithSmartFallback(node, inputs, usedOutputsSet);
          if (isCancelledRef.current) break;

          node.data.resultUrl = outUrl;
          node.data.status = 'done';
          node.data.error = null;
          runtimeOutputs[node.id] = outUrl;
          if (outUrl) usedOutputsSet.add(outUrl);
          updateNodeData(node.id, { resultUrl: outUrl, status: 'done', error: null });
          autoExportNodeResultToDisk(node, outUrl, stepIndex);
          executedSet.add(node.id);
          stepIndex++;

          // NGHỈ ĐỆM 4 GIÂY CÓ ĐẾM LÙI (KHÔNG LÀM NHANH) ĐỂ MUSE AI ỔN ĐỊNH VÀ KẾT QUẢ ĐƯỢC NẠP HOÀN TOÀN TRƯỚC KHI CHUYỂN BƯỚC
          for (let sec = 4; sec > 0; sec--) {
            if (isCancelledRef.current) break;
            setStatusBanner(
              `⏳ [Bước ${stepIndex - 1}/${totalSteps}] Đã có kết quả "${node.data.title}" trên bàn vẽ! Nghỉ ${sec}s để Muse AI ổn định rồi mới chuyển sang bước tiếp theo...`
            );
            await new Promise((r) => setTimeout(r, 1000));
          }
        } catch (nodeErr) {
          if (isCancelledRef.current) {
            break;
          }
          updateNodeData(node.id, { status: 'error', error: nodeErr.message });
          throw nodeErr;
        }

        // QUY TẮC NHÁNH CÂY (DFS): Ngay sau khi Node này hoàn thành, nếu dây nối của nó sinh ra
        // Node tiếp theo (và Node đó đã đủ toàn bộ đầu vào), ĐẨY NGAY VÀO ĐẦU HÀNG ĐỢI (unshift)
        // để chạy dứt điểm nhánh cây này cho xong (Ví dụ: Thử đồ Nhánh 1 -> Video Nhánh 1 luôn)
        // chứ KHÔNG nhảy cóc sang chạy thử đồ của Nhánh 2!
        const outgoingTargets = adjList[node.id] || [];
        const readyImmediateChildren = [];

        for (const targetId of outgoingTargets) {
          if (executedSet.has(targetId) || executionQueue.includes(targetId)) continue;

          // Kiểm tra xem TẤT CẢ các node nguồn của targetId đã chạy xong chưa
          const targetInEdges = edges.filter((e) => e.target === targetId);
          const allPrereqsDone = targetInEdges.every((e) => Boolean(runtimeOutputs[e.source]));

          if (allPrereqsDone) {
            readyImmediateChildren.push(targetId);
          }
        }

        // Đưa ngay các con nối tiếp vào ĐẦU hàng đợi (Depth-First Branching)
        if (readyImmediateChildren.length > 0) {
          executionQueue.unshift(...readyImmediateChildren);
        }
      }

      if (isCancelledRef.current) {
        setStatusBanner('⏹️ Đã dừng Workflow theo yêu cầu.');
        return;
      }

      setStatusBanner(`🎉 Hoàn tất thành công ${executedSet.size}/${totalSteps} Nodes theo đúng 100% sơ đồ dây nối!`);
      setTimeout(() => setStatusBanner(''), 6000);
    } catch (err) {
      if (isCancelledRef.current) {
        setStatusBanner('⏹️ Đã dừng Workflow.');
      } else {
        setStatusBanner('❌ Lỗi: ' + err.message);
      }
    } finally {
      setIsRunningAll(false);
    }
  };

  const runFullWorkflowRef = useRef(handleRunFullWorkflow);
  runFullWorkflowRef.current = handleRunFullWorkflow;

  useEffect(() => {
    const onTriggerRun = () => {
      if (runFullWorkflowRef.current) {
        runFullWorkflowRef.current();
      }
    };
    window.addEventListener('AI_CANVAS_TRIGGER_WORKFLOW_RUN', onTriggerRun);
    return () => window.removeEventListener('AI_CANVAS_TRIGGER_WORKFLOW_RUN', onTriggerRun);
  }, []);

  const buildBezierPath = (x1, y1, x2, y2) => {
    const dx = Math.max(60, Math.abs(x2 - x1) * 0.45);
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  const connectingSourceNode = connectingFromNodeId
    ? nodes.find((n) => n.id === connectingFromNodeId)
    : null;

  return (
    <div className="relative w-full h-full overflow-hidden select-none flex flex-col">
      {/* Thanh công cụ Kính Quang Học (Glass-on-Glass Toolbar) */}
      <div className="px-4 pt-3 z-20 shrink-0">
        <div className="box px-4 py-2.5 flex flex-wrap items-center justify-between gap-2" style={{ '--r': '24px' }}>
          <div className="circle-overlay" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-extrabold opacity-75 mr-1">Thêm Node Kính:</span>
            <button
              onClick={() => handleAddNode('IMAGE_INPUT')}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <Upload className="w-3.5 h-3.5 text-sky-600" /> + Cột 1: Ảnh Đầu Vào
            </button>
            <button
              onClick={() => handleAddNode('FLOW_IMAGE_GEN')}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <ImageIcon className="w-3.5 h-3.5 text-cyan-600" /> + Cột 2: Tạo Ảnh (Flow)
            </button>
            <button
              onClick={() => handleAddNode('FLOW_VIDEO_GEN')}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <Video className="w-3.5 h-3.5 text-teal-600" /> + Cột 3: Tạo Video (Veo 2)
            </button>
            <button
              onClick={() => handleAddNode('FFMPEG_POST')}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> + Cột 4: Upscale &amp; Nhạc
            </button>
            <button
              onClick={handleAddSticker}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
              style={{ '--r': '999px', width: 'auto' }}
              title="Thêm ghi chú (Sticker 便签)"
            >
              <div className="circle-overlay" />
              <StickyNote className="w-3.5 h-3.5 text-amber-500" /> + Ghi chú
            </button>
            <button
              onClick={handleImportDaCanvasJson}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
              style={{ '--r': '999px', width: 'auto' }}
              title="Dán / Nhập JSON dự án da-ai-canvas"
            >
              <div className="circle-overlay" />
              <FileJson className="w-3.5 h-3.5 text-indigo-600" /> Nhập JSON
            </button>
          </div>

          <div className="flex items-center gap-2.5">
            {statusBanner && (
              <div
                className="box px-3.5 py-1.5 text-xs font-bold text-sky-800 flex items-center gap-2 max-w-md truncate"
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                {isRunningAll && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-sky-600" />}
                <span className="truncate">{statusBanner}</span>
              </div>
            )}

            <div className="box flex items-center p-1 text-xs" style={{ '--r': '999px', width: 'auto' }}>
              <div className="circle-overlay" />
              <button
                onClick={() => setZoom((z) => Math.max(0.4, Number((z - 0.1).toFixed(2))))}
                className="p-1.5 hover:bg-white/30 rounded-full cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="px-2 font-mono font-bold text-xs">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.1).toFixed(2))))}
                className="p-1.5 hover:bg-white/30 rounded-full cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setPan({ x: 60, y: 40 });
                  setZoom(0.95);
                }}
                className="p-1.5 hover:bg-white/30 rounded-full cursor-pointer"
                title="Reset góc nhìn"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {isRunningAll ? (
              <div className="flex items-center gap-2">
                <button
                  disabled
                  className="box active-pill px-4 py-2 text-xs font-extrabold flex items-center gap-2 opacity-85"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  <span>Đang chạy Workflow...</span>
                </button>
                <button
                  onClick={handleStopWorkflow}
                  className="px-4 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center gap-1.5 shadow-md shadow-rose-900/30 transition-all cursor-pointer"
                  title="Dừng tiến trình chạy ngay lập tức"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Dừng lại</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleRunFullWorkflow}
                className="box box-hover active-pill px-5 py-2 text-xs font-extrabold flex items-center gap-2"
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                <Play className="w-4 h-4 fill-current text-sky-600" />
                Chạy Toàn Bộ Workflow
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Vùng Bàn Vẽ Sơ Đồ Node Mượt 120FPS */}
      <div
        ref={containerRef}
        onMouseDown={handleCanvasMouseDown}
        onWheel={handleWheel}
        className="flex-1 relative overflow-hidden"
        style={{ cursor: isPanning ? 'grabbing' : connectingFromNodeId ? 'crosshair' : 'grab' }}
      >
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: '0 0',
            position: 'absolute',
            top: 0,
            left: 0,
            width: '1px',
            height: '1px'
          }}
        >
          {/* Lớp SVG vẽ dây cáp quang học bạc xanh & hiệu ứng dòng chảy loading khi đang chạy */}
          <style>{`@keyframes cableDashFlow { to { stroke-dashoffset: -44; } }`}</style>
          <svg
            width="5000"
            height="4000"
            className="absolute top-0 left-0 pointer-events-none overflow-visible"
          >
            <defs>
              <linearGradient id="cableSilverCyan" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#0284c7" />
                <stop offset="50%" stopColor="#06b6d4" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <linearGradient id="cableActiveFlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
              <filter id="edgeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {edges.map((edge) => {
              const srcNode = nodes.find((n) => n.id === edge.source);
              const tgtNode = nodes.find((n) => n.id === edge.target);
              if (!srcNode || !tgtNode) return null;

              const x1 = srcNode.x + NODE_WIDTH;
              const y1 = srcNode.y + PORT_OFFSET_Y;
              const x2 = tgtNode.x;
              const y2 = tgtNode.y + PORT_OFFSET_Y;
              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;
              const bezierD = buildBezierPath(x1, y1, x2, y2);
              const isEdgeRunning = tgtNode.data?.status === 'running';

              return (
                <g key={edge.id} className="pointer-events-auto group">
                  {/* Đường ẩn dày hơn để dễ rê chuột vào dây */}
                  <path
                    d={bezierD}
                    stroke="transparent"
                    strokeWidth="18"
                    fill="none"
                  />
                  {/* Lớp phát sáng nền khi dây đang truyền tải tới Node đang chạy */}
                  {isEdgeRunning && (
                    <path
                      d={bezierD}
                      stroke="#38bdf8"
                      strokeWidth="10"
                      strokeOpacity="0.35"
                      filter="url(#edgeGlow)"
                      fill="none"
                    />
                  )}
                  {/* Đường dây cáp nền */}
                  <path
                    d={bezierD}
                    stroke={isEdgeRunning ? 'rgba(14,165,233,0.35)' : 'url(#cableSilverCyan)'}
                    strokeWidth="4"
                    fill="none"
                  />
                  {/* Hiệu ứng xung ánh sáng chạy dọc theo dây khi đang xử lý Node đích */}
                  {isEdgeRunning && (
                    <>
                      <path
                        d={bezierD}
                        stroke="url(#cableActiveFlow)"
                        strokeWidth="4.5"
                        strokeDasharray="12 10"
                        strokeLinecap="round"
                        fill="none"
                        style={{ animation: 'cableDashFlow 0.7s linear infinite' }}
                      />
                      <circle r="5.5" fill="#ffffff" stroke="#0ea5e9" strokeWidth="2.5" filter="url(#edgeGlow)">
                        <animateMotion dur="1.15s" repeatCount="indefinite" path={bezierD} />
                      </circle>
                    </>
                  )}
                  <g
                    transform={`translate(${midX - 12}, ${midY - 12})`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      handleDeleteEdge(edge.id);
                    }}
                    className="edge-delete-btn cursor-pointer opacity-60 group-hover:opacity-100"
                  >
                    <circle cx="12" cy="12" r="11" fill="#ffffff" stroke="#ef4444" strokeWidth="2" />
                    <text x="12" y="16" fill="#ef4444" fontSize="13" fontWeight="bold" dx="-4">
                      ×
                    </text>
                  </g>
                </g>
              );
            })}

            {connectingSourceNode && (
              <path
                d={buildBezierPath(
                  connectingSourceNode.x + NODE_WIDTH,
                  connectingSourceNode.y + PORT_OFFSET_Y,
                  mouseCanvasPos.x,
                  mouseCanvasPos.y
                )}
                stroke="#0284c7"
                strokeWidth="3.5"
                strokeDasharray="6 4"
                fill="none"
              />
            )}
          </svg>

          {/* Danh sách Ghi Chú Kính (Stickers / 便签 từ da-ai-canvas) */}
          {stickers.map((sticker) => (
            <div
              key={sticker.id}
              style={{
                width: `${sticker.width || 280}px`,
                transform: `translate3d(${sticker.x}px, ${sticker.y}px, 0)`
              }}
              className="workflow-sticker-card absolute top-0 left-0 z-10"
            >
              <div
                style={{ '--r': '22px' }}
                className="box w-full flex flex-col items-stretch justify-start ring-1 ring-amber-400/50"
              >
                <div className="circle-overlay" />
                <div
                  onMouseDown={(e) => {
                    if (e.target.closest('button')) return;
                    e.stopPropagation();
                    e.preventDefault();
                    draggingStickerRef.current = {
                      stickerId: sticker.id,
                      startMouseX: e.clientX,
                      startMouseY: e.clientY,
                      startX: sticker.x,
                      startY: sticker.y
                    };
                  }}
                  className="px-3.5 py-2 border-b border-amber-400/30 bg-amber-400/15 flex items-center justify-between cursor-grab active:cursor-grabbing"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-amber-800 dark:text-amber-300">
                    <StickyNote className="w-3.5 h-3.5 text-amber-600" />
                    <span>{sticker.title || '便签 (Ghi chú)'}</span>
                  </div>
                  <button
                    onClick={() =>
                      setStickers((prev) => prev.filter((s) => s.id !== sticker.id))
                    }
                    className="text-amber-700/70 hover:text-red-500 cursor-pointer p-0.5"
                    title="Xóa ghi chú"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div
                  className="p-3.5 text-xs font-semibold leading-relaxed space-y-1 bg-amber-300/10"
                  dangerouslySetInnerHTML={{ __html: sticker.html || '' }}
                />
              </div>
            </div>
          ))}

          {/* Danh sách các Node Kính Quang Học (Kính Lấy Kính - Glass on Glass) */}
          {nodes.map((node) => {
            const meta = NODE_TYPES_META[node.type] || NODE_TYPES_META.FLOW_IMAGE_GEN;
            const isSelected = selectedNodeId === node.id;
            const isDropTarget =
              connectingFromNodeId &&
              connectingFromNodeId !== node.id &&
              meta.hasInput &&
              hoveredTargetNodeId === node.id;

            return (
              <div
                key={node.id}
                onMouseEnter={() => {
                  if (connectingFromNodeId && connectingFromNodeId !== node.id && meta.hasInput) {
                    setHoveredTargetNodeId(node.id);
                  }
                }}
                onMouseLeave={() => {
                  if (hoveredTargetNodeId === node.id) {
                    setHoveredTargetNodeId(null);
                  }
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                }}
                style={{
                  width: `${NODE_WIDTH}px`,
                  transform: `translate3d(${node.x}px, ${node.y}px, 0)`
                }}
                className="workflow-node-card absolute top-0 left-0 overflow-visible"
              >
                {/* Cổng Input Kính (Bên trái) */}
                {meta.hasInput && (
                  <div
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      if (connectingFromNodeId && connectingFromNodeId !== node.id) {
                        connectTwoNodes(connectingFromNodeId, node.id);
                        setConnectingFromNodeId(null);
                        setHoveredTargetNodeId(null);
                      }
                    }}
                    title="Thả dây nối vào đây (Input)"
                    style={{
                      top: `${PORT_OFFSET_Y - 15}px`,
                      '--r': '50%',
                      width: '30px',
                      height: '30px',
                      position: 'absolute',
                      left: '-15px'
                    }}
                    className="box hover:scale-125 flex items-center justify-center cursor-crosshair z-30"
                  >
                    <div className="circle-overlay" />
                    <div className="w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]" />
                  </div>
                )}

                {/* Cổng Output Kính (Bên phải) - Kéo từ đây sang bất kỳ đâu trên Node tiếp theo để nối dây! */}
                {meta.hasOutput && (
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setConnectingFromNodeId(node.id);
                      setMouseCanvasPos(screenToCanvas(e.clientX, e.clientY));
                    }}
                    title="Giữ chuột kéo dây từ đây thả vào Node tiếp theo (Output)"
                    style={{
                      top: `${PORT_OFFSET_Y - 15}px`,
                      '--r': '50%',
                      width: '30px',
                      height: '30px',
                      position: 'absolute',
                      right: '-15px'
                    }}
                    className="box hover:scale-125 flex items-center justify-center cursor-crosshair z-30"
                  >
                    <div className="circle-overlay" />
                    <div className="w-3 h-3 rounded-full bg-teal-500 shadow-[0_0_8px_#14b8a6]" />
                  </div>
                )}

                {/* Khối Kính Chính Của Node (.box + .circle-overlay) */}
                <div
                  style={{ '--r': '28px' }}
                  className={
                    `box w-full flex flex-col items-stretch justify-start ` +
                    (node.data.status === 'running'
                      ? 'ring-4 ring-sky-400/90 scale-[1.01]'
                      : isDropTarget
                      ? 'ring-4 ring-emerald-400/60 scale-[1.02]'
                      : isSelected
                      ? 'ring-2 ring-sky-400/60'
                      : '')
                  }
                >
                  <div className="circle-overlay" />

                  {/* Thanh tiêu đề Node Kính (Nơi giữ chuột để kéo di chuyển Node) */}
                  <div
                    onMouseDown={(e) => {
                      if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
                      e.stopPropagation();
                      e.preventDefault();
                      setSelectedNodeId(node.id);
                      draggingNodeRef.current = {
                        nodeId: node.id,
                        startMouseX: e.clientX,
                        startMouseY: e.clientY,
                        startNodeX: node.x,
                        startNodeY: node.y
                      };
                    }}
                    className="w-full px-4 pt-3.5 pb-2.5 border-b border-white/40 flex items-center justify-between cursor-grab active:cursor-grabbing"
                  >
                    <div className="flex flex-col gap-1">
                      <div
                        className="box px-2.5 py-0.5 text-[10px] font-extrabold w-fit"
                        style={{ '--r': '999px', width: 'fit-content' }}
                      >
                        <div className="circle-overlay" />
                        <span className="text-sky-800">{meta.label}</span>
                      </div>
                      <input
                        value={node.data.title || ''}
                        onChange={(e) => updateNodeData(node.id, { title: e.target.value })}
                        className="bg-transparent text-xs font-black focus:outline-none mt-0.5 w-48"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      className="box box-hover w-7 h-7 flex items-center justify-center text-red-500 cursor-pointer"
                      style={{ '--r': '50%', width: '28px', height: '28px' }}
                      title="Xóa Node"
                    >
                      <div className="circle-overlay" />
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Nội dung thân Node (Các lớp kính con lồng bên trong kính mẹ) */}
                  <div className="w-full p-3.5 flex flex-col gap-3 text-xs">
                    {/* 1. Node Ảnh Đầu Vào */}
                    {node.type === 'IMAGE_INPUT' && (
                      <div className="flex flex-col gap-2 w-full">
                        {node.data.imageUrl ? (
                          <>
                            <div
                              className="box relative group h-44 w-full flex items-center justify-center p-2 overflow-hidden"
                              style={{ '--r': '20px' }}
                            >
                              <div className="circle-overlay" />
                              <img
                                src={node.data.imageUrl}
                                alt="input"
                                className="max-h-full max-w-full object-contain rounded-xl"
                              />
                              <label className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold cursor-pointer rounded-2xl">
                                📤 Bấm để đổi ảnh khác
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    handleUploadToNode(node.id, e.target.files?.[0]);
                                    e.target.value = '';
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </div>
                            <label
                              className="box box-hover w-full py-1.5 text-[11px] font-extrabold text-sky-700 flex items-center justify-center gap-1.5 cursor-pointer"
                              style={{ '--r': '999px' }}
                            >
                              <div className="circle-overlay" />
                              <Upload className="w-3.5 h-3.5 text-sky-600" />
                              <span>Đổi ảnh đầu vào khác</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  handleUploadToNode(node.id, e.target.files?.[0]);
                                  e.target.value = '';
                                }}
                                className="hidden"
                              />
                            </label>
                          </>
                        ) : (
                          <label
                            className="box box-hover h-40 w-full flex flex-col items-center justify-center gap-2 text-sky-700 font-extrabold cursor-pointer"
                            style={{ '--r': '20px' }}
                          >
                            <div className="circle-overlay" />
                            <Upload className="w-6 h-6 text-sky-600" />
                            <span>Bấm tải ảnh lên Kính</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                handleUploadToNode(node.id, e.target.files?.[0]);
                                e.target.value = '';
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    )}

                    {/* 2. Node Tạo Ảnh hoặc Tạo Video Google Flow */}
                    {(node.type === 'FLOW_IMAGE_GEN' || node.type === 'FLOW_VIDEO_GEN') && (
                      <>
                        <div className="flex flex-col gap-1 w-full">
                          <span className="text-[11px] font-extrabold opacity-75">Câu lệnh Prompt:</span>
                          <div className="box w-full p-2" style={{ '--r': '16px' }}>
                            <div className="circle-overlay" />
                            <textarea
                              rows={3}
                              value={node.data.prompt || ''}
                              onChange={(e) => updateNodeData(node.id, { prompt: e.target.value })}
                              className="w-full bg-transparent text-xs font-semibold focus:outline-none resize-none"
                            />
                          </div>
                        </div>

                        {node.type === 'FLOW_VIDEO_GEN' && (
                          <div className="grid grid-cols-2 gap-2 w-full">
                            <div>
                              <span className="text-[10px] font-bold opacity-75">Tỷ lệ khung hình:</span>
                              <div className="box w-full mt-0.5 px-2 py-1" style={{ '--r': '12px' }}>
                                <div className="circle-overlay" />
                                <select
                                  value={node.data.aspectRatio || '9:16'}
                                  onChange={(e) => updateNodeData(node.id, { aspectRatio: e.target.value })}
                                  className="w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
                                >
                                  <option value="9:16" className="text-slate-900">9:16 (Dọc TikTok)</option>
                                  <option value="16:9" className="text-slate-900">16:9 (Ngang)</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold opacity-75">Chất lượng:</span>
                              <div className="box w-full mt-0.5 px-2 py-1" style={{ '--r': '12px' }}>
                                <div className="circle-overlay" />
                                <select
                                  value={node.data.resolution || '480p'}
                                  onChange={(e) => updateNodeData(node.id, { resolution: e.target.value })}
                                  className="w-full bg-transparent text-xs font-bold focus:outline-none cursor-pointer"
                                >
                                  <option value="480p" className="text-slate-900">480p (Nhanh)</option>
                                  <option value="720p" className="text-slate-900">720p HD</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}

                        {node.data.resultUrl ? (
                          <div
                            className="box relative h-44 w-full flex items-center justify-center p-1.5 overflow-hidden"
                            style={{ '--r': '20px' }}
                          >
                            <div className="circle-overlay" />
                            {isVideoMedia(node.data.resultUrl, node.type) ? (
                              <video
                                src={node.data.resultUrl}
                                controls
                                loop
                                autoPlay
                                muted
                                className="max-h-full max-w-full rounded-xl"
                              />
                            ) : (
                              <div className="relative max-h-full max-w-full flex items-center justify-center">
                                <img
                                  src={node.data.resultUrl}
                                  alt="result"
                                  className="max-h-full max-w-full object-contain rounded-xl"
                                />
                                {node.type === 'FLOW_VIDEO_GEN' && (
                                  <div className="absolute bottom-1.5 left-1.5 bg-sky-950/85 backdrop-blur-xs text-sky-200 text-[10px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 border border-sky-400/30">
                                    🎬 Video Poster
                                  </div>
                                )}
                              </div>
                            )}
                            {node.data.status === 'running' && (
                              <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 text-white font-extrabold text-xs z-20 rounded-2xl">
                                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                                <span>Đang xử lý Node...</span>
                              </div>
                            )}
                            <a
                              href={node.data.resultUrl}
                              download={`flow-${node.id}.${isVideoMedia(node.data.resultUrl, node.type) ? 'mp4' : 'png'}`}
                              className="box absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-sky-700 z-10"
                              style={{ '--r': '50%', width: '28px', height: '28px' }}
                              title={isVideoMedia(node.data.resultUrl, node.type) ? 'Tải Video MP4' : 'Tải Ảnh'}
                            >
                              <div className="circle-overlay" />
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <div
                            className="box h-28 w-full flex items-center justify-center text-[11px] font-bold text-center px-3 opacity-85"
                            style={{ '--r': '18px' }}
                          >
                            <div className="circle-overlay" />
                            {node.data.status === 'running' ? (
                              <div className="flex flex-col items-center gap-1.5 text-sky-700 font-extrabold">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Đang xử lý trên Google Flow...</span>
                              </div>
                            ) : (
                              <span>Kết quả sẽ hiển thị trong khung kính này &amp; truyền sang Output</span>
                            )}
                          </div>
                        )}
                      </>
                    )}

                    {/* 3. Node Upscale & Ghép Nhạc (Cột 4) */}
                    {node.type === 'FFMPEG_POST' && (
                      <>
                        <div className="flex flex-col gap-1 w-full">
                          <span className="text-[11px] font-extrabold opacity-75">Link nhạc nền MP3 (Tùy chọn):</span>
                          <div className="box w-full px-3 py-1.5" style={{ '--r': '14px' }}>
                            <div className="circle-overlay" />
                            <input
                              type="text"
                              value={node.data.bgmUrl || ''}
                              onChange={(e) => updateNodeData(node.id, { bgmUrl: e.target.value })}
                              placeholder="https://example.com/bgm.mp3"
                              className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                            />
                          </div>
                        </div>

                        {node.data.resultUrl ? (
                          <div
                            className="box relative h-44 w-full flex items-center justify-center p-1.5 overflow-hidden"
                            style={{ '--r': '20px' }}
                          >
                            <div className="circle-overlay" />
                            {isVideoMedia(node.data.resultUrl) ? (
                              <video
                                src={node.data.resultUrl}
                                controls
                                loop
                                autoPlay
                                className="max-h-full max-w-full rounded-xl"
                              />
                            ) : (
                              <img
                                src={node.data.resultUrl}
                                alt="result"
                                className="max-h-full max-w-full object-contain rounded-xl"
                              />
                            )}
                            <a
                              href={node.data.resultUrl}
                              download={`final-hd-${Date.now()}.${isVideoMedia(node.data.resultUrl) ? 'mp4' : 'png'}`}
                              className="box absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-emerald-700"
                              style={{ '--r': '50%', width: '28px', height: '28px' }}
                              title={isVideoMedia(node.data.resultUrl) ? 'Tải Video HD MP4' : 'Tải Ảnh'}
                            >
                              <div className="circle-overlay" />
                              <Download className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        ) : (
                          <div
                            className="box h-24 w-full flex items-center justify-center text-[11px] font-bold opacity-85"
                            style={{ '--r': '18px' }}
                          >
                            <div className="circle-overlay" />
                            <span>Nhận Video từ Cột 3 -&gt; Xuất Video HD</span>
                          </div>
                        )}
                      </>
                    )}

                    {node.data.error && (
                      <div
                        className="box p-2 w-full text-red-600 font-bold text-[11px]"
                        style={{ '--r': '14px' }}
                      >
                        <div className="circle-overlay" />
                        <span>{node.data.error}</span>
                      </div>
                    )}

                    {/* Chọn nhanh nối dây sang Node khác (Kính con lồng trong kính mẹ) */}
                    {meta.hasOutput && (
                      <div className="box w-full px-2.5 py-1.5 flex items-center gap-1.5" style={{ '--r': '14px' }}>
                        <div className="circle-overlay" />
                        <Link2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) connectTwoNodes(node.id, e.target.value);
                          }}
                          className="w-full bg-transparent text-[11px] font-bold cursor-pointer focus:outline-none"
                        >
                          <option value="" className="text-slate-900">+ Nối dây nhanh từ Node này sang...</option>
                          {nodes
                            .filter((target) => target.id !== node.id && NODE_TYPES_META[target.type]?.hasInput)
                            .map((target) => (
                              <option key={target.id} value={target.id} className="text-slate-900">
                                ➔ {target.data.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {node.type !== 'IMAGE_INPUT' && (
                      <button
                        onClick={() => executeSingleNode(node.id).catch((e) => setStatusBanner('❌ ' + e.message))}
                        disabled={node.data.status === 'running' || isRunningAll}
                        className="box box-hover active-pill w-full py-2 text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-50"
                        style={{ '--r': '999px' }}
                      >
                        <div className="circle-overlay" />
                        {node.data.status === 'running' ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600" /> Đang chạy...
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3 fill-current text-sky-600" /> Chạy riêng Node này
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Thanh Pill & Bảng Nhật Ký Hoạt Động (Logs) góc dưới trái - Nhấn để mở rộng hoặc thu gọn */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2 pointer-events-auto">
        {isLogPanelOpen && (
          <div className="w-[380px] max-w-[calc(100vw-32px)] max-h-[300px] rounded-2xl bg-slate-900/95 backdrop-blur-md border border-sky-400/35 text-slate-100 shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/90 border-b border-white/10 text-xs font-bold">
              <span>📋 Nhật ký chạy Workflow &amp; Muse AI</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() =>
                    api.post('/open-output-folder', {
                      projectTitle: project?.title || project?.name || 'Untitled Project',
                      projectId: project?.id || ''
                    }).catch(() => {})
                  }
                  className="px-2 py-0.5 rounded-md bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 text-[11px] font-semibold transition cursor-pointer"
                  title="Mở thư mục Output chứa ảnh/video đã tự động xuất"
                >
                  📂 Output
                </button>
                <button
                  onClick={() =>
                    window.postMessage(
                      {
                        source: 'AI_CANVAS_WEB',
                        type: 'OPEN_SPLIT_WINDOWS',
                        payload: { canvasUrl: window.location.href },
                        jobId: 'split-' + Date.now()
                      },
                      '*'
                    )
                  }
                  className="px-2 py-0.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[11px] font-semibold transition cursor-pointer"
                  title="Mở 2 cửa sổ song song (Trái: Tool, Phải: Muse AI)"
                >
                  🪟 Chia đôi
                </button>
                <button
                  onClick={() =>
                    window.postMessage({ source: 'AI_CANVAS_WEB', type: 'FOCUS_FLOW_TAB', jobId: 'focus-' + Date.now() }, '*')
                  }
                  className="px-2 py-0.5 rounded-md bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 text-[11px] font-semibold transition cursor-pointer"
                  title="Chuyển sang xem tab Muse AI"
                >
                  Mở tab Muse
                </button>
                <button
                  onClick={() => setBridgeLogs([])}
                  className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                >
                  Xóa
                </button>
                <button
                  onClick={() => setIsLogPanelOpen(false)}
                  className="px-2 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                >
                  Thu gọn ▾
                </button>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[245px] p-1.5 space-y-0.5 text-[11px]">
              {bridgeLogs.length === 0 ? (
                <div className="text-center text-slate-400 py-4">Chưa có nhật ký hoạt động.</div>
              ) : (
                bridgeLogs
                  .slice()
                  .reverse()
                  .map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 border-b border-white/5"
                    >
                      <span
                        className={`w-2 h-2 rounded-full mt-1 shrink-0 ${
                          log.level === 'error'
                            ? 'bg-rose-500'
                            : log.level === 'success'
                            ? 'bg-emerald-400'
                            : log.level === 'warn'
                            ? 'bg-amber-400'
                            : 'bg-sky-400'
                        }`}
                      />
                      <span className="font-mono text-slate-400 shrink-0">{log.time}</span>
                      <span className="px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-bold text-sky-300 shrink-0">
                        {log.source}
                      </span>
                      <span className="text-slate-200 break-words leading-snug">{log.text}</span>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsLogPanelOpen((v) => !v)}
          title="Nhấn để mở / thu gọn Nhật ký hoạt động"
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white shadow-xl border backdrop-blur-md transition cursor-pointer ${
            isRunningAll
              ? 'bg-amber-500/95 border-amber-300/60'
              : bridgeLogs[bridgeLogs.length - 1]?.level === 'error'
              ? 'bg-rose-600/95 border-rose-300/60'
              : 'bg-emerald-600/95 border-emerald-300/60'
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_8px_#fff]" />
          <span className="max-w-[300px] truncate">
            {bridgeLogs[bridgeLogs.length - 1]?.text || 'Sẵn sàng chạy Workflow ngầm'}
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-black/25 text-[10px] font-extrabold">
            {bridgeLogs.length}
          </span>
          <span className="text-[10px] opacity-90">{isLogPanelOpen ? '▼' : '▲'}</span>
        </button>
      </div>
    </div>
  );
}
