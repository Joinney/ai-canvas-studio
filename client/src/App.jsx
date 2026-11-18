import React, { useRef, useState, useEffect } from 'react';
import {
  Download,
  Settings,
  CheckCircle2,
  X,
  KeyRound,
  Workflow,
  Play,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Layers,
  Sun,
  Moon
} from 'lucide-react';
import InfiniteCanvas from './components/InfiniteCanvas';
import Toolbar from './components/Toolbar';
import PromptDock from './components/PromptDock';
import LayerPanel from './components/LayerPanel';
import LayerProperties from './components/LayerProperties';
import HomeDashboard, { PRESET_TEMPLATES } from './components/HomeDashboard';
import WorkflowNodeCanvas from './components/WorkflowNodeCanvas';
import {
  WINTER_FUR_PROJECT,
  MIRROR_SELFIE_PROJECT,
  BEAUTY_MIST_PROJECT,
  AUTUMN_OUTFIT_PROJECT,
  BLUSH_LIVESTREAM_PROJECT,
  ECOM_TRYON_OUTFIT_PROJECT,
  MAHJONG_SILHOUETTE_VFX_PROJECT,
  MIDDLE_AGED_FASHION_TVC_PROJECT,
  WUXIA_BAGUAZHANG_PROJECT,
  INSTANT_OUTFIT_CHANGE_PROJECT,
  ELEVATOR_FASHION_REF_PROJECT,
  OUTDOOR_STREETWEAR_LOOKBOOK_PROJECT,
  MATURE_FASHION_COMMERCE_PROJECT
} from './utils/daCanvasConverter';

const cloneProjectSafe = (proj) => {
  if (!proj) return proj;
  try {
    return JSON.parse(JSON.stringify(proj));
  } catch (e) {
    return { ...proj };
  }
};

const ALL_BUILTIN_PRESETS = [
  MIRROR_SELFIE_PROJECT,
  BEAUTY_MIST_PROJECT,
  AUTUMN_OUTFIT_PROJECT,
  BLUSH_LIVESTREAM_PROJECT,
  ECOM_TRYON_OUTFIT_PROJECT,
  MAHJONG_SILHOUETTE_VFX_PROJECT,
  MIDDLE_AGED_FASHION_TVC_PROJECT,
  WUXIA_BAGUAZHANG_PROJECT,
  INSTANT_OUTFIT_CHANGE_PROJECT,
  ELEVATOR_FASHION_REF_PROJECT,
  OUTDOOR_STREETWEAR_LOOKBOOK_PROJECT,
  MATURE_FASHION_COMMERCE_PROJECT,
  WINTER_FUR_PROJECT
];
const BUILTIN_PRESET_IDS = new Set(ALL_BUILTIN_PRESETS.map((p) => p.id));
import { useCanvasStore } from './store/useCanvasStore';
import { getAIConfig, saveAIConfig } from './services/api';
import {
  getFlowPoolStatus,
  pingGoogleFlowTab,
  executeGoogleFlowNode,
  runFourColumnFashionWorkflow
} from './services/flowBridge';

const STORAGE_KEY = 'ai_canvas_studio_projects_v1';

// Trích xuất ID dự án từ URL (Hỗ trợ cả Hash routing #/project/:id lẫn Path routing /project/:id)
function getProjectIdFromLocation() {
  const hash = window.location.hash || '';
  const matchHash = hash.match(/^#\/project\/([^/?#]+)/i);
  if (matchHash) return matchHash[1];

  const path = window.location.pathname || '';
  const matchPath = path.match(/^\/project\/([^/?#]+)/i);
  if (matchPath) return matchPath[1];

  return null;
}

export default function App() {
  const stageRef = useRef(null);
  const maskLayerRef = useRef(null);
  const { zoom, images, addImage, setSelectedId } = useCanvasStore();

  // Điều hướng chuẩn URL:
  // - URL là '/' hoặc '#/' -> Ra Trang chủ (currentProject = null)
  // - URL là '/project/:id' hoặc '#/project/:id' -> Ra Trang của dự án đó
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'image' | 'my-projects'
  const [currentProject, setCurrentProject] = useState(() => {
    const projId = getProjectIdFromLocation();
    if (!projId) {
      return null; // URL là / hoặc #/ -> Vào đúng Trang chủ!
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        const found = parsed.find((p) => p.id === projId);
        if (found) {
          if (projId === MAHJONG_SILHOUETTE_VFX_PROJECT.id && !found.nodes?.some((n) => n.id === 'node-1792750922750-0')) {
            return cloneProjectSafe(MAHJONG_SILHOUETTE_VFX_PROJECT);
          }
          if (projId === MIDDLE_AGED_FASHION_TVC_PROJECT.id && !found.nodes?.some((n) => n.id === 'node-1789366823140-0')) {
            return cloneProjectSafe(MIDDLE_AGED_FASHION_TVC_PROJECT);
          }
          return found;
        }
      }
    } catch (e) {}
    if (projId === MIRROR_SELFIE_PROJECT.id) return MIRROR_SELFIE_PROJECT;
    if (projId === WINTER_FUR_PROJECT.id) return WINTER_FUR_PROJECT;
    if (projId === BEAUTY_MIST_PROJECT.id) return BEAUTY_MIST_PROJECT;
    if (projId === AUTUMN_OUTFIT_PROJECT.id) return AUTUMN_OUTFIT_PROJECT;
    if (projId === BLUSH_LIVESTREAM_PROJECT.id) return BLUSH_LIVESTREAM_PROJECT;
    if (projId === ECOM_TRYON_OUTFIT_PROJECT.id) return ECOM_TRYON_OUTFIT_PROJECT;
    if (projId === MAHJONG_SILHOUETTE_VFX_PROJECT.id) return cloneProjectSafe(MAHJONG_SILHOUETTE_VFX_PROJECT);
    if (projId === MIDDLE_AGED_FASHION_TVC_PROJECT.id) return cloneProjectSafe(MIDDLE_AGED_FASHION_TVC_PROJECT);
    if (projId === WUXIA_BAGUAZHANG_PROJECT.id) return cloneProjectSafe(WUXIA_BAGUAZHANG_PROJECT);
    if (projId === INSTANT_OUTFIT_CHANGE_PROJECT.id) return cloneProjectSafe(INSTANT_OUTFIT_CHANGE_PROJECT);
    if (projId === ELEVATOR_FASHION_REF_PROJECT.id) return cloneProjectSafe(ELEVATOR_FASHION_REF_PROJECT);
    if (projId === OUTDOOR_STREETWEAR_LOOKBOOK_PROJECT.id) return cloneProjectSafe(OUTDOOR_STREETWEAR_LOOKBOOK_PROJECT);
    if (projId === MATURE_FASHION_COMMERCE_PROJECT.id) return cloneProjectSafe(MATURE_FASHION_COMMERCE_PROJECT);
    return null;
  });
  const [isDarkMode, setIsDarkMode] = useState(false);

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      if (next) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      return next;
    });
  };

  const [userProjects, setUserProjects] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Chỉ giữ Dự án Cá nhân / Lịch sử (tách biệt hoàn toàn khỏi Dự án Mẫu)
          const personalOnly = parsed
            .filter((p) => p && p.id && !BUILTIN_PRESET_IDS.has(p.id) && !p.isPreset)
            .map((p) => cloneProjectSafe({ ...p, isPreset: false }));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(personalOnly));
          return personalOnly;
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      return [];
    } catch (e) {
      return [];
    }
  });

  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showFlowModal, setShowFlowModal] = useState(false);
  const [flowStatus, setFlowStatus] = useState({ connected: false, activeWorkers: 0, maxConcurrentTabs: 3 });
  const [pingMessage, setPingMessage] = useState('');
  const [flowMode, setFlowMode] = useState('PIPELINE_4_COL');
  const [flowImagePrompt, setFlowImagePrompt] = useState(
    'Full body 3-angle fashion lookbook (front, side, back) wearing this outfit, clean studio background, commercial fashion photography'
  );
  const [flowVideoPrompt, setFlowVideoPrompt] = useState(
    'Fashion model walking confidently on studio runway, smooth camera motion, 9:16 vertical video'
  );
  const [flowBgmUrl, setFlowBgmUrl] = useState('');
  const [flowRunning, setFlowRunning] = useState(false);
  const [flowProgressText, setFlowProgressText] = useState('');

  const [configStatus, setConfigStatus] = useState({
    activeProvider: 'Free Cloud GPU (Wan 2.2 14B / LTX-Video Real AI)',
    hasFalKey: false,
    hasArkKey: false,
    arkBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3'
  });
  const [falKeyInput, setFalKeyInput] = useState('');
  const [arkKeyInput, setArkKeyInput] = useState('');
  const [arkUrlInput, setArkUrlInput] = useState('https://ark.cn-beijing.volces.com/api/v3');
  const [savingConfig, setSavingConfig] = useState(false);

  // Lưu danh sách dự án vào localStorage
  const persistProjects = (nextList) => {
    setUserProjects(nextList);
    try {
      // Không lưu chuỗi Base64 quá nặng vào localStorage nếu vượt giới hạn bộ nhớ trình duyệt
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.warn('Lưu localStorage vượt dung lượng, chỉ lưu cấu trúc Node:', e);
    }
  };

  // Điều hướng phân trang giữa Trang chủ và Trang dự án (luôn clone tách biệt dữ liệu từng dự án):
  const navigateToProject = (proj) => {
    if (!proj) return;
    setCurrentProject(cloneProjectSafe(proj));
    if (proj.id && window.location.hash !== `#/project/${proj.id}`) {
      window.location.hash = `#/project/${proj.id}`;
    }
  };

  const navigateToHome = () => {
    setCurrentProject(null);
    if (window.location.hash && window.location.hash !== '#/' && window.location.hash !== '') {
      window.location.hash = '#/';
    } else if (window.location.pathname.startsWith('/project/')) {
      window.history.pushState(null, '', '/');
    }
  };

  const handleSaveCurrentProject = (updatedProj, shouldUpdateCurrentState = true) => {
    if (!updatedProj?.id) return;
    const safeUpdated = cloneProjectSafe(updatedProj);
    if (shouldUpdateCurrentState) {
      setCurrentProject((prev) => (prev && prev.id === safeUpdated.id ? { ...prev, ...safeUpdated } : safeUpdated));
      if (safeUpdated?.id && window.location.hash !== `#/project/${safeUpdated.id}`) {
        window.location.hash = `#/project/${safeUpdated.id}`;
      }
    }
    setUserProjects((prev) => {
      const exists = prev.some((p) => p.id === safeUpdated.id);
      const next = exists
        ? prev.map((p) => (p.id === safeUpdated.id ? { ...p, ...safeUpdated } : p))
        : [safeUpdated, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Đồng bộ lưu trực tiếp xuống ổ cứng (d:\Nodejs\project\ai-canvas-studio\server\data\projects.json)
    fetch('http://localhost:5001/api/ai/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(safeUpdated)
    }).catch(() => {});
  };

  const handleCreateBlankProject = ({ category = 'video', name, workspaceMode = 'workflow' }) => {
    // Khi tạo dự án Workflow mới, khởi tạo sẵn 1 Node Ảnh Đầu Vào và 1 Node Tạo Ảnh/Video mẫu để dễ kéo nối thêm
    const defaultNodes =
      workspaceMode === 'workflow'
        ? [
            {
              id: 'node-input-1',
              type: 'IMAGE_INPUT',
              x: 80,
              y: 140,
              data: { title: 'Ảnh Đầu Vào 1', imageUrl: '', status: 'idle' }
            },
            {
              id: 'node-gen-1',
              type: category === 'video' ? 'FLOW_VIDEO_GEN' : 'FLOW_IMAGE_GEN',
              x: 460,
              y: 140,
              data:
                category === 'video'
                  ? {
                      title: 'Tạo Video Veo 2 (Google Flow)',
                      prompt:
                        'Fashion model walking confidently on studio runway, smooth camera motion, 9:16 vertical video',
                      aspectRatio: '9:16',
                      resolution: '480p',
                      resultUrl: '',
                      status: 'idle'
                    }
                  : {
                      title: 'Tạo Ảnh 3 Góc Độ (Google Flow)',
                      prompt:
                        'Full body 3-angle fashion lookbook (front, side, back) wearing this outfit, clean studio background',
                      resultUrl: '',
                      status: 'idle'
                    }
            }
          ]
        : [];

    const defaultEdges =
      workspaceMode === 'workflow'
        ? [{ id: 'edge-init-1', source: 'node-input-1', target: 'node-gen-1' }]
        : [];

    const newProj = {
      id: 'proj-' + Date.now(),
      category,
      name,
      description:
        workspaceMode === 'workflow'
          ? 'Sơ đồ Workflow tùy chỉnh — Tự do thêm Node và kéo dây nối.'
          : 'Bàn vẽ AI Studio tự do (Inpaint & Tách nền).',
      workspaceMode,
      nodes: defaultNodes,
      edges: defaultEdges,
      updatedAt: new Date().toISOString()
    };

    persistProjects([newProj, ...userProjects]);
    navigateToProject(newProj);
    fetch('http://localhost:5001/api/ai/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProj)
    }).catch(() => {});
  };

  // Khi bấm vào Dự án Mẫu -> Tự động nhân bản thành Dự án Cá nhân (lưu lịch sử) và mở ra
  const handleUseTemplate = (template) => {
    if (!template) return;
    const nowIso = new Date().toISOString();
    const cloned = cloneProjectSafe(template);
    cloned.id = `proj-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    cloned.isPreset = false;
    cloned.sourceTemplateId = template.id;
    cloned.createdAt = nowIso;
    cloned.updatedAt = nowIso;

    persistProjects([cloned, ...userProjects]);
    navigateToProject(cloned);
    fetch('http://localhost:5001/api/ai/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cloned)
    }).catch(() => {});
  };

  const handleDeleteProject = (projId) => {
    // Tuyệt đối không cho xóa Dự án Mẫu
    if (!projId || BUILTIN_PRESET_IDS.has(projId)) return;
    const next = userProjects.filter((p) => p.id !== projId);
    persistProjects(next);
    try {
      localStorage.removeItem(`ai_canvas_workflow_state_${projId}`);
    } catch (e) {}
    fetch(`http://localhost:5001/api/ai/projects/${projId}`, {
      method: 'DELETE'
    }).catch(() => {});
  };

  const checkExtensionConnection = async () => {
    const status = await getFlowPoolStatus();
    setFlowStatus(status);
  };

  const handleTestPingFlow = async () => {
    setFlowProgressText('Đang bắn tín hiệu Ping sang tab Google Flow...');
    setPingMessage('Đang gửi tín hiệu Ping...');
    try {
      const res = await pingGoogleFlowTab();
      await checkExtensionConnection();
      if (res && res.success) {
        const msg = `✅ Kết nối 2 chiều THÀNH CÔNG! (Tab: ${res.tabId})`;
        setFlowProgressText(msg);
        setPingMessage(msg);
      } else {
        const errText = '⚠️ ' + (res?.error || 'Hãy nhấn F5 tại tab Google Flow rồi thử lại.');
        setFlowProgressText(errText);
        setPingMessage(errText);
      }
    } catch (err) {
      setFlowProgressText('❌ ' + err.message);
      setPingMessage('❌ ' + err.message);
    }
  };

  useEffect(() => {
    // Tải danh sách Dự án Cá nhân / Lịch sử trên ổ cứng (tách riêng khỏi Dự án Mẫu)
    fetch('http://localhost:5001/api/ai/projects')
      .then((r) => r.json())
      .then((data) => {
        const list = data && Array.isArray(data.projects) ? data.projects : [];
        const personalFromServer = list
          .filter((p) => p && p.id && !BUILTIN_PRESET_IDS.has(p.id) && !p.isPreset)
          .map((p) => cloneProjectSafe({ ...p, isPreset: false }));

        setUserProjects((prevLocal) => {
          const map = new Map();
          for (const p of prevLocal) {
            if (p && p.id && !BUILTIN_PRESET_IDS.has(p.id) && !p.isPreset) {
              map.set(p.id, p);
            }
          }
          for (const p of personalFromServer) {
            if (!map.has(p.id)) {
              map.set(p.id, p);
            }
          }
          const merged = Array.from(map.values());
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      })
      .catch(() => {});

    getAIConfig()
      .then((res) => {
        if (res && res.activeProvider) {
          setConfigStatus(res);
          if (res.arkBaseUrl) setArkUrlInput(res.arkBaseUrl);
        }
      })
      .catch(() => {});

    checkExtensionConnection();
    const onMsg = (e) => {
      if (e.data && e.data.source === 'AI_CANVAS_EXTENSION' && e.data.type === 'BRIDGE_READY') {
        checkExtensionConnection();
      }
    };
    window.addEventListener('AI_CANVAS_EXTENSION_READY', checkExtensionConnection);
    window.addEventListener('message', onMsg);

    // Đồng bộ phân trang giữa URL và trạng thái màn hình (Trang chủ vs Trang dự án)
    const syncRouteWithLocation = () => {
      const projId = getProjectIdFromLocation();
      if (!projId) {
        setCurrentProject(null);
      } else {
        setUserProjects((currentList) => {
          const found = currentList.find((p) => p.id === projId);
          if (found) {
            setCurrentProject(found);
          } else if (projId === WINTER_FUR_PROJECT.id) {
            setCurrentProject(WINTER_FUR_PROJECT);
          }
          return currentList;
        });
      }
    };
    window.addEventListener('hashchange', syncRouteWithLocation);
    window.addEventListener('popstate', syncRouteWithLocation);

    return () => {
      window.removeEventListener('AI_CANVAS_EXTENSION_READY', checkExtensionConnection);
      window.removeEventListener('message', onMsg);
      window.removeEventListener('hashchange', syncRouteWithLocation);
      window.removeEventListener('popstate', syncRouteWithLocation);
    };
  }, []);

  const handleRunGoogleFlow = async (e) => {
    e.preventDefault();
    if (currentProject && currentProject.workspaceMode !== 'freeform') {
      setShowFlowModal(false);
      window.dispatchEvent(new CustomEvent('AI_CANVAS_TRIGGER_WORKFLOW_RUN'));
      return;
    }

    const imageLayers = images.filter((i) => i.type !== 'video');
    if (imageLayers.length === 0) {
      return alert('Hãy tải lên ít nhất 1 tấm ảnh trên bàn vẽ Canvas trước khi chạy Google Flow!');
    }

    setFlowRunning(true);
    setFlowProgressText('Đang gửi tác vụ sang Chrome Extension (Google Flow Worker Pool)...');
    try {
      if (flowMode === 'SINGLE_IMAGE' || imageLayers.length === 1) {
        const res = await executeGoogleFlowNode({
          mode: 'IMAGE',
          images: imageLayers.slice(0, 2).map((i) => i.url),
          prompt: flowImagePrompt
        });
        addImage({
          id: 'flow-img-' + Date.now(),
          name: 'Flow 3D Outfit',
          type: 'image',
          url: res.base64 || res.rawUrl,
          x: imageLayers[0].x + 380,
          y: imageLayers[0].y,
          width: 340,
          height: 340
        });
      } else {
        const modelImg = imageLayers[0].url;
        const outfitImgs = imageLayers.slice(1).map((i) => i.url);
        await runFourColumnFashionWorkflow({
          modelImageBase64: modelImg,
          outfitImagesBase64: outfitImgs,
          imagePrompt: flowImagePrompt,
          videoPrompt: flowVideoPrompt,
          bgmAudioUrl: flowBgmUrl.trim() || null,
          onProgress: (info) => {
            if (info.message) setFlowProgressText(info.message);
            if (info.step === 2 && info.resultBase64) {
              addImage({
                id: `flow-col2-${Date.now()}-${info.branchIndex}`,
                name: `Cột 2 - Ảnh 3 chiều #${info.branchIndex + 1}`,
                type: 'image',
                url: info.resultBase64,
                x: 420,
                y: 120 + info.branchIndex * 360,
                width: 320,
                height: 320
              });
            }
            if ((info.step === 3 || info.step === 4) && info.resultBase64) {
              addImage({
                id: `flow-col${info.step}-${Date.now()}-${info.branchIndex}`,
                name:
                  info.step === 4
                    ? `Cột 4 - Video HD #${info.branchIndex + 1}`
                    : `Cột 3 - Video 480p #${info.branchIndex + 1}`,
                type: 'video',
                url: info.resultBase64,
                x: info.step === 4 ? 1140 : 780,
                y: 120 + info.branchIndex * 360,
                width: 270,
                height: 480
              });
            }
          }
        });
      }
      setShowFlowModal(false);
    } catch (err) {
      alert('Lỗi chạy Google Flow Bridge: ' + err.message);
    } finally {
      setFlowRunning(false);
      setFlowProgressText('');
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const payload = { arkBaseUrl: arkUrlInput };
      if (falKeyInput.trim()) payload.falKey = falKeyInput.trim();
      if (arkKeyInput.trim()) payload.arkApiKey = arkKeyInput.trim();

      const updated = await saveAIConfig(payload);
      setConfigStatus(updated);
      setFalKeyInput('');
      setArkKeyInput('');
      setShowConfigModal(false);
    } catch (err) {
      alert('Lỗi lưu cấu hình API: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleExportMerged = () => {
    if (!stageRef.current || images.length === 0) return alert('Chưa có ảnh nào trên bàn vẽ!');
    setSelectedId(null);

    setTimeout(() => {
      const stage = stageRef.current;
      const minX = Math.min(...images.map((i) => i.x));
      const minY = Math.min(...images.map((i) => i.y));
      const maxX = Math.max(...images.map((i) => i.x + i.width));
      const maxY = Math.max(...images.map((i) => i.y + i.height));

      const scale = stage.scaleX();
      const stageX = stage.x();
      const stageY = stage.y();

      const dataURL = stage.toDataURL({
        x: minX * scale + stageX,
        y: minY * scale + stageY,
        width: (maxX - minX) * scale,
        height: (maxY - minY) * scale,
        pixelRatio: 2 / scale
      });

      const a = document.createElement('a');
      a.href = dataURL;
      a.download = 'ai-canvas-merged-' + Date.now() + '.png';
      a.click();
    }, 100);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      {/* ================= 1. MÀN HÌNH TRANG CHỦ (SIDEBAR + DANH SÁCH DỰ ÁN) ================= */}
      {!currentProject ? (
        <HomeDashboard
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userProjects={userProjects}
          onOpenProject={(proj) => navigateToProject(proj)}
          onUseTemplate={handleUseTemplate}
          onCreateBlankProject={handleCreateBlankProject}
          onDeleteProject={handleDeleteProject}
          flowStatus={flowStatus}
          onCheckFlow={checkExtensionConnection}
          onPingFlow={handleTestPingFlow}
          pingMessage={pingMessage}
          onOpenApiConfig={() => setShowConfigModal(true)}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
        />
      ) : (
        /* ================= 2. KHÔNG GIAN LÀM VIỆC DỰ ÁN (NODE WORKFLOW / FREEFORM CANVAS) ================= */
        <div className="w-screen h-screen flex flex-col overflow-hidden">
          {/* Thanh Header Kính Quang Học của Dự án */}
          <div className="px-4 pt-3 z-30 shrink-0">
            <header className="box px-5 py-2.5 flex items-center justify-between" style={{ '--r': '24px' }}>
              <div className="circle-overlay" />
              <div className="flex items-center gap-3">
                <button
                  onClick={navigateToHome}
                  className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <ArrowLeft className="w-4 h-4 text-sky-600" /> Trang chủ
                </button>

                <div className="h-5 w-[1px] bg-slate-400/30" />

                <input
                  value={currentProject.name || ''}
                  onChange={(e) =>
                    handleSaveCurrentProject({ ...currentProject, name: e.target.value })
                  }
                  className="bg-transparent text-sm font-black focus:outline-none focus:border-b border-sky-500 px-1"
                />
              </div>

              {/* Chuyển đổi qua lại giữa Sơ đồ Node Workflow & Bàn vẽ Tự do Inpaint */}
              <div className="box flex items-center p-1 text-xs gap-1.5" style={{ '--r': '999px', width: 'auto' }}>
                <div className="circle-overlay" />
                <button
                  onClick={() =>
                    handleSaveCurrentProject({ ...currentProject, workspaceMode: 'workflow' })
                  }
                  className={
                    'box px-3.5 py-1.5 font-extrabold flex items-center gap-1.5 cursor-pointer ' +
                    (currentProject.workspaceMode !== 'freeform' ? 'active-pill' : 'opacity-70')
                  }
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <Workflow className="w-3.5 h-3.5 text-sky-600" /> Sơ đồ Node Workflow
                </button>
                <button
                  onClick={() =>
                    handleSaveCurrentProject({ ...currentProject, workspaceMode: 'freeform' })
                  }
                  className={
                    'box px-3.5 py-1.5 font-extrabold flex items-center gap-1.5 cursor-pointer ' +
                    (currentProject.workspaceMode === 'freeform' ? 'active-pill' : 'opacity-70')
                  }
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <Layers className="w-3.5 h-3.5 text-teal-600" /> Bàn vẽ Tự do (Inpaint)
                </button>
              </div>

              {/* Cụm nút Sáng/Tối & Kết nối Flow Bridge */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleTheme}
                  className="box box-hover px-3 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                  title="Chuyển giao diện Sáng / Tối"
                >
                  <div className="circle-overlay" />
                  {isDarkMode ? (
                    <>
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sáng</span>
                    </>
                  ) : (
                    <>
                      <Moon className="w-3.5 h-3.5 text-slate-700" />
                      <span>Tối</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    checkExtensionConnection();
                    setShowFlowModal(true);
                  }}
                  className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-2"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <Workflow className="w-3.5 h-3.5 text-emerald-600" />
                  Flow Bridge
                  <span
                    className={
                      'w-2.5 h-2.5 rounded-full ' +
                      (flowStatus.connected ? 'bg-emerald-500' : 'bg-amber-500')
                    }
                  />
                </button>

                {currentProject.workspaceMode === 'freeform' && (
                  <button
                    onClick={handleExportMerged}
                    className="box box-hover active-pill px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5"
                    style={{ '--r': '999px', width: 'auto' }}
                  >
                    <div className="circle-overlay" />
                    <Download className="w-3.5 h-3.5 text-sky-600" /> Xuất ảnh HD
                  </button>
                )}
              </div>
            </header>
          </div>

          {/* Vùng Bàn Vẽ Chính */}
          <div className="flex-1 relative overflow-hidden">
            {currentProject.workspaceMode !== 'freeform' ? (
              <WorkflowNodeCanvas
                key={currentProject.id}
                project={currentProject}
                onSaveProject={(updated) => handleSaveCurrentProject(updated, false)}
              />
            ) : (
              <div className="relative w-full h-full">
                <Toolbar />
                <LayerPanel />
                <LayerProperties />
                <InfiniteCanvas stageRef={stageRef} maskLayerRef={maskLayerRef} />
                <PromptDock exportMaskBase64={() => maskLayerRef.current?.toDataURL()} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Kết nối & Chạy Google Flow Extension Bridge (Kính Lấy Kính) */}
      {showFlowModal && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="box w-full max-w-xl p-6 flex flex-col gap-4 items-stretch"
            style={{ '--r': '30px' }}
          >
            <div className="circle-overlay" />
            <div className="flex items-center justify-between border-b border-white/40 pb-3 w-full">
              <div className="flex items-center gap-2 font-black text-sm">
                <Workflow className="w-4 h-4 text-emerald-600" />
                Google Flow Bridge (Auto-Piping Base64 + Multi-Tab Pool)
              </div>
              <button
                onClick={() => setShowFlowModal(false)}
                className="box box-hover w-8 h-8 flex items-center justify-center cursor-pointer"
                style={{ '--r': '50%', width: '32px', height: '32px' }}
              >
                <div className="circle-overlay" />
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="box p-3.5 text-xs flex items-center justify-between w-full" style={{ '--r': '18px' }}>
              <div className="circle-overlay" />
              <div>
                <b>Trạng thái Chrome Extension: </b>
                {flowStatus.connected
                  ? `Đã kết nối (${flowStatus.openFlowTabs || 1} tab Google Flow đang mở / Tối đa ${flowStatus.maxConcurrentTabs || 3} tab song song)`
                  : 'Chưa phát hiện Extension'}
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={checkExtensionConnection}
                  className="box box-hover px-2.5 py-1 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <RefreshCw className="w-3 h-3" /> Kiểm tra
                </button>
                <button
                  type="button"
                  onClick={handleTestPingFlow}
                  className="box box-hover active-pill px-2.5 py-1 text-xs font-extrabold cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  ⚡ Test Ping Google Flow
                </button>
              </div>
            </div>

            <form onSubmit={handleRunGoogleFlow} className="flex flex-col gap-3 text-xs w-full">
              <div className="flex flex-col gap-1 w-full">
                <label className="font-extrabold opacity-80">Chế độ chạy nhanh từ Bàn vẽ Tự do:</label>
                <div className="box px-3 py-2 w-full" style={{ '--r': '14px' }}>
                  <div className="circle-overlay" />
                  <select
                    value={flowMode}
                    onChange={(e) => setFlowMode(e.target.value)}
                    className="w-full bg-transparent font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="PIPELINE_4_COL" className="text-slate-900">
                      Chạy trọn bộ 4 Cột (Ảnh 1 làm Mẫu + Các ảnh còn lại làm Trang phục -&gt; Tạo Ảnh 3D -&gt; Video 480p -&gt; Upscale 1080p)
                    </option>
                    <option value="SINGLE_IMAGE" className="text-slate-900">
                      Chỉ chạy Cột 2 (Ghép 2 ảnh đầu tiên trên Canvas thành ảnh 3 góc độ trên Google Flow)
                    </option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="font-extrabold opacity-80">Prompt Cột 2 (Image Mode - Imagen 3):</label>
                <div className="box px-3 py-2 w-full" style={{ '--r': '14px' }}>
                  <div className="circle-overlay" />
                  <textarea
                    rows={2}
                    value={flowImagePrompt}
                    onChange={(e) => setFlowImagePrompt(e.target.value)}
                    className="w-full bg-transparent font-semibold focus:outline-none resize-none"
                  />
                </div>
              </div>

              {flowMode === 'PIPELINE_4_COL' && (
                <>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="font-extrabold opacity-80">Prompt Cột 3 (Video Mode - Veo 2 480p 9:16):</label>
                    <div className="box px-3 py-2 w-full" style={{ '--r': '14px' }}>
                      <div className="circle-overlay" />
                      <textarea
                        rows={2}
                        value={flowVideoPrompt}
                        onChange={(e) => setFlowVideoPrompt(e.target.value)}
                        className="w-full bg-transparent font-semibold focus:outline-none resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 w-full">
                    <label className="font-extrabold opacity-80">
                      Link nhạc nền MP3 cho Cột 4 (Tùy chọn - FFmpeg tự trộn vào video 1080p):
                    </label>
                    <div className="box px-3 py-2 w-full" style={{ '--r': '14px' }}>
                      <div className="circle-overlay" />
                      <input
                        type="text"
                        value={flowBgmUrl}
                        onChange={(e) => setFlowBgmUrl(e.target.value)}
                        placeholder="https://example.com/music.mp3"
                        className="w-full bg-transparent font-semibold focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {flowProgressText && (
                <div className="box p-2.5 w-full flex items-center gap-2 font-bold" style={{ '--r': '14px' }}>
                  <div className="circle-overlay" />
                  {flowRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-sky-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <span>{flowProgressText}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-white/40 w-full">
                <button
                  type="button"
                  onClick={() => setShowFlowModal(false)}
                  className="box box-hover px-4 py-2 font-extrabold cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={flowRunning}
                  className="box box-hover active-pill px-4 py-2 font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  {flowRunning ? <Loader2 className="w-4 h-4 animate-spin text-sky-600" /> : <Play className="w-4 h-4 text-sky-600" />}
                  {flowRunning ? 'Đang chạy Workflow...' : 'Bắt đầu chạy Google Flow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cấu hình API Phụ Trợ (Kính Lấy Kính) */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-slate-900/35 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div
            className="box w-full max-w-lg p-6 flex flex-col gap-4 items-stretch"
            style={{ '--r': '30px' }}
          >
            <div className="circle-overlay" />
            <div className="flex items-center justify-between border-b border-white/40 pb-3 w-full">
              <div className="flex items-center gap-2 font-black text-sm">
                <KeyRound className="w-4 h-4 text-sky-600" />
                Cấu hình Nguồn Tạo Video AI Phụ Trợ (Seedance / Cloud GPU)
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="box box-hover w-8 h-8 flex items-center justify-center cursor-pointer"
                style={{ '--r': '50%', width: '32px', height: '32px' }}
              >
                <div className="circle-overlay" />
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="flex flex-col gap-3 text-xs w-full">
              <div className="flex flex-col gap-1 w-full">
                <label className="font-extrabold opacity-80">1. Fal.ai API Key:</label>
                <div className="box px-3 py-2 w-full" style={{ '--r': '14px' }}>
                  <div className="circle-overlay" />
                  <input
                    type="password"
                    value={falKeyInput}
                    onChange={(e) => setFalKeyInput(e.target.value)}
                    placeholder={configStatus.hasFalKey ? '•••••••• (Đã lưu FAL_KEY)' : 'Nhập FAL_KEY...'}
                    className="w-full bg-transparent font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1 w-full">
                <label className="font-extrabold opacity-80">2. Volcengine Ark / BytePlus API Key:</label>
                <div className="box px-3 py-2 w-full" style={{ '--r': '14px' }}>
                  <div className="circle-overlay" />
                  <input
                    type="password"
                    value={arkKeyInput}
                    onChange={(e) => setArkKeyInput(e.target.value)}
                    placeholder={configStatus.hasArkKey ? '•••••••• (Đã lưu ARK_API_KEY)' : 'Nhập ARK_API_KEY...'}
                    className="w-full bg-transparent font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/40 w-full">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="box box-hover px-4 py-2 font-extrabold cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="box box-hover active-pill px-4 py-2 font-extrabold cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  {savingConfig ? 'Đang lưu...' : 'Lưu Cấu Hình'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
