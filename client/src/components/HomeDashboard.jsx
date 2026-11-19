import React, { useState, useEffect, useRef } from 'react';
import {
  Video,
  Image as ImageIcon,
  FolderKanban,
  Plus,
  Workflow,
  Sparkles,
  Play,
  Trash2,
  RefreshCw,
  Settings,
  Layers,
  ArrowRight,
  Search,
  Sun,
  Moon,
  Clock,
  Volume2,
  VolumeX,
  Grid,
  Wand2,
  BookOpen,
  MessageSquare,
  Flame,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  PanelLeft,
  Film,
  Zap,
  Copy,
  Check
} from 'lucide-react';
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
  MATURE_FASHION_COMMERCE_PROJECT,
  CLAYMATION_BOBO_BEAR_PROJECT,
  VIETNAM_TRAVEL_VLOG_PROJECT,
  HOT_SOUR_NOODLES_TVC_PROJECT
} from '../utils/daCanvasConverter';

// Danh sách các Mẫu Dự Án (Templates) dựng sẵn chuẩn da-ai-canvas (KHÔNG ĐƯỢC XÓA)
export const PRESET_TEMPLATES = [
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
  CLAYMATION_BOBO_BEAR_PROJECT,
  VIETNAM_TRAVEL_VLOG_PROJECT,
  HOT_SOUR_NOODLES_TVC_PROJECT,
  WINTER_FUR_PROJECT
];

function HoverPreviewVideo({ src, poster, isHovered, isUnmuted, className = '' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isHovered) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isHovered]);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster || undefined}
      muted={!isUnmuted}
      loop
      playsInline
      preload="metadata"
      className={className}
    />
  );
}

export default function HomeDashboard({
  activeTab,
  setActiveTab,
  userProjects,
  onOpenProject,
  onUseTemplate,
  onCreateBlankProject,
  onDeleteProject,
  flowStatus,
  onCheckFlow,
  onPingFlow,
  pingMessage,
  onOpenApiConfig,
  isDarkMode,
  onToggleTheme
}) {
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectMode, setNewProjectMode] = useState('workflow');
  const [searchQuery, setSearchQuery] = useState('');
  const [clockStr, setClockStr] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [unmutedCardId, setUnmutedCardId] = useState(null);
  const [currentModule, setCurrentModule] = useState('dashboard'); // 'dashboard' | 'imageCreation' | 'apps' | 'canvas' | 'workflow' | 'my'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'video' | 'image' | 'my-projects' | 'featured'

  // Trích xuất Media đại diện từ bất kỳ Dự án / Mẫu nào
  const extractCardMedia = (item) => {
    const nodes = item?.nodes || [];
    const hdVideoNode = nodes.find((n) => n.type === 'FFMPEG_POST' && n.data?.resultUrl);
    const flowVideoNode = nodes.find((n) => n.type === 'FLOW_VIDEO_GEN' && n.data?.resultUrl);
    const anyMp4Node = nodes.find(
      (n) =>
        (n.data?.resultUrl && (n.data.resultUrl.endsWith('.mp4') || n.data.resultUrl.startsWith('data:video/'))) ||
        (n.data?.imageUrl && n.data.imageUrl.endsWith('.mp4'))
    );

    const videoUrl =
      hdVideoNode?.data?.resultUrl ||
      flowVideoNode?.data?.resultUrl ||
      anyMp4Node?.data?.resultUrl ||
      item?.previewVideo ||
      '';

    const imageUrl =
      nodes.find((n) => n.data?.resultUrl && !n.data.resultUrl.endsWith('.mp4'))?.data?.resultUrl ||
      nodes.find((n) => n.data?.imageUrl && !n.data.imageUrl.endsWith('.mp4'))?.data?.imageUrl ||
      item?.previewImage ||
      '';

    return { videoUrl, imageUrl };
  };

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockStr(
        now.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleConfirmNewProject = (e) => {
    e.preventDefault();
    const title =
      newProjectTitle.trim() ||
      (newProjectMode === 'freeform' ? 'Bàn vẽ Vô cực mới' : 'Dự án Sơ đồ Node mới');
    onCreateBlankProject({
      category: categoryFilter === 'image' ? 'image' : 'video',
      name: title,
      workspaceMode: newProjectMode
    });
    setNewProjectTitle('');
    setShowNewModal(false);
  };

  const [copiedTemplateId, setCopiedTemplateId] = useState(null);

  const handleCopyTemplateJson = async (e, tpl) => {
    e.stopPropagation();
    const exportPayload = {
      name: tpl.name,
      nodes: tpl.nodes || [],
      edges: tpl.edges || [],
      stickers: tpl.stickers || []
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
      setCopiedTemplateId(tpl.id);
      setTimeout(() => {
        setCopiedTemplateId((prev) => (prev === tpl.id ? null : prev));
      }, 2000);
    } catch {
      window.prompt('Copy JSON mẫu dự án bên dưới:', JSON.stringify(exportPayload));
    }
  };

  const handleOpenTemplateCard = (tpl) => {
    if (onUseTemplate) {
      onUseTemplate(tpl);
    } else {
      onOpenProject(tpl);
    }
  };

  // Tách riêng hoàn toàn: Dự án Cá nhân / Lịch sử (có thể xóa) vs Dự án Mẫu (không thể xóa)
  const personalProjects = userProjects
    .filter((up) => up && up.id && !PRESET_TEMPLATES.some((pt) => pt.id === up.id) && !up.isPreset)
    .filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        (item.name || '').toLowerCase().includes(q) ||
        (item.description || '').toLowerCase().includes(q)
      );
    });

  const filteredTemplates = PRESET_TEMPLATES.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (item.name || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q);
    if (!matchSearch) return false;

    if (categoryFilter === 'all' || categoryFilter === 'featured') return true;
    if (categoryFilter === 'video') return item.category === 'video' || item.name.toLowerCase().includes('video');
    if (categoryFilter === 'image' || categoryFilter === 'tryon') {
      return (
        item.category === 'image' ||
        item.category === 'tryon' ||
        /try-on|thử đồ|lookbook|outfit/i.test(item.name || '')
      );
    }
    if (categoryFilter === 'beauty') {
      return /beauty|blush|mist|livestream|vfx|tvc/i.test(item.name || '');
    }
    return true;
  });

  const heroShowcaseTemplates = [
    MIRROR_SELFIE_PROJECT,
    BEAUTY_MIST_PROJECT,
    AUTUMN_OUTFIT_PROJECT
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-900 dark:text-white select-none">
      {/* ================= 1. SIDEBAR TRÁI (QUANTV AI LAYOUT + LIQUID GLASS, TỰ ĐỘNG ẨN) ================= */}
      <aside
        className={`shrink-0 h-full flex flex-col justify-between border-white/20 dark:border-white/5 backdrop-blur-2xl z-30 transition-all duration-300 ease-out ${
          isSidebarOpen
            ? 'w-64 p-4 border-r overflow-y-auto opacity-100'
            : 'w-0 p-0 border-r-0 overflow-hidden opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col gap-5 min-w-[224px]">
          {/* Logo & Tên ứng dụng + Nút đẩy ẩn sang trái */}
          <div className="flex items-center justify-between gap-2 px-1 py-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="box w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer shadow-lg shadow-sky-500/20 overflow-hidden p-0.5"
                style={{ '--r': '16px' }}
                onClick={() => {
                  setCurrentModule('dashboard');
                  setCategoryFilter('all');
                }}
              >
                <div className="circle-overlay" />
                <img
                  src="/logo.jpg"
                  alt="AI Canvas Studio Logo"
                  className="w-full h-full rounded-[14px] object-cover shadow-inner"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-black text-sm tracking-tight leading-tight truncate">AI CANVAS STUDIO</span>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 dark:text-sky-400 truncate">
                  AI Studio • Lab
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="box box-hover w-7 h-7 flex items-center justify-center shrink-0 cursor-pointer"
              style={{ '--r': '50%' }}
              title="Thu gọn Sidebar sang trái"
            >
              <div className="circle-overlay" />
              <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          {/* Nút Tạo Mới Nổi Bật */}
          <button
            onClick={() => {
              setNewProjectMode('workflow');
              setShowNewModal(true);
            }}
            className="w-full py-2.5 px-4 rounded-full flex items-center justify-center gap-2 text-xs font-black text-white bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:brightness-110 transition-all shadow-md shadow-sky-500/30 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>TẠO DỰ ÁN MỚI</span>
          </button>

          {/* Menu Nhóm 1: Khám Phá */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
              Khám Phá
            </span>

            <button
              onClick={() => {
                setCurrentModule('dashboard');
                setCategoryFilter('all');
              }}
              className={
                'box box-hover w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-extrabold cursor-pointer transition ' +
                (currentModule === 'dashboard' ? 'active-pill ring-1 ring-sky-500/50' : 'opacity-80')
              }
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <Grid className="w-4 h-4 text-sky-500" />
              <span>Home • Trang Chủ</span>
            </button>
          </div>

          {/* Menu Nhóm 2: Sáng Tạo Chính (Creative Studio) */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
              Công Cụ Sáng Tạo
            </span>

            <button
              onClick={() => {
                setCurrentModule('imageCreation');
                setCategoryFilter('image');
              }}
              className={
                'box box-hover w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-extrabold cursor-pointer transition ' +
                (currentModule === 'imageCreation' ? 'active-pill ring-1 ring-sky-500/50' : 'opacity-80')
              }
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <ImageIcon className="w-4 h-4 text-teal-500" />
              <span>Image Studio • Thử Đồ 2K</span>
            </button>

            <button
              onClick={() => {
                setCurrentModule('apps');
                setCategoryFilter('video');
              }}
              className={
                'box box-hover w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-extrabold cursor-pointer transition ' +
                (currentModule === 'apps' ? 'active-pill ring-1 ring-sky-500/50' : 'opacity-80')
              }
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <Video className="w-4 h-4 text-indigo-500" />
              <span>Video Studio • Video 9:16</span>
            </button>

            <button
              onClick={() => {
                onCreateBlankProject({
                  category: 'image',
                  name: 'Bàn vẽ Vô cực (Canvas Inpaint)',
                  workspaceMode: 'freeform'
                });
              }}
              className="box box-hover w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-extrabold cursor-pointer opacity-80"
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <Layers className="w-4 h-4 text-cyan-500" />
              <span>Infinite Canvas • Bàn Vẽ Vô Cực</span>
            </button>

            <button
              onClick={() => {
                setCurrentModule('workflow');
                setCategoryFilter('featured');
              }}
              className={
                'box box-hover w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-extrabold cursor-pointer transition ' +
                (currentModule === 'workflow' ? 'active-pill ring-1 ring-sky-500/50' : 'opacity-80')
              }
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <Workflow className="w-4 h-4 text-amber-500" />
              <span>Node Workflow • Sơ Đồ DAG</span>
            </button>
          </div>

          {/* Menu Nhóm 3: Dự Án & Quản Lý */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3">
              Kho Cá Nhân
            </span>

            <button
              onClick={() => {
                setCurrentModule('my');
                setCategoryFilter('my-projects');
              }}
              className={
                'box box-hover w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-extrabold cursor-pointer transition ' +
                (categoryFilter === 'my-projects' ? 'active-pill ring-1 ring-sky-500/50' : 'opacity-80')
              }
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <div className="flex items-center gap-3">
                <FolderKanban className="w-4 h-4 text-blue-500" />
                <span>My Projects • Dự Án Của Tôi</span>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
                {userProjects.length}
              </span>
            </button>

            <button
              onClick={onOpenApiConfig}
              className="box box-hover w-full px-3.5 py-2.5 flex items-center gap-3 text-xs font-extrabold cursor-pointer opacity-80"
              style={{ '--r': '14px' }}
            >
              <div className="circle-overlay" />
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Cấu Hình API Key</span>
            </button>
          </div>
        </div>

        {/* Khối Thông Tin Trạng Thái Dưới Cùng Của Sidebar */}
        <div className="flex flex-col gap-3 pt-4 border-t border-white/20 dark:border-white/5">
          {/* Trạng thái Muse AI & Flow Bridge */}
          <div className="box p-3 flex flex-col gap-2" style={{ '--r': '16px' }}>
            <div className="circle-overlay" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-black">
                <span
                  className={
                    'w-2 h-2 rounded-full ' +
                    (flowStatus.connected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')
                  }
                />
                <span>AI ENGINE BRIDGE</span>
              </div>
              <button
                onClick={onCheckFlow}
                className="box box-hover w-6 h-6 flex items-center justify-center cursor-pointer"
                style={{ '--r': '50%' }}
                title="Kiểm tra lại kết nối"
              >
                <div className="circle-overlay" />
                <RefreshCw className="w-3 h-3 text-sky-600" />
              </button>
            </div>
            <span className="text-[10px] font-bold opacity-75">
              {flowStatus.connected
                ? `🟢 Sẵn sàng (${flowStatus.openFlowTabs || 1} tab mở)`
                : '🟠 Chưa phát hiện tab AI Engine'}
            </span>
          </div>

          {/* User Profile & Theme Toggle Card */}
          <div className="box p-3 flex items-center justify-between" style={{ '--r': '16px' }}>
            <div className="circle-overlay" />
            <div className="flex items-center gap-2.5">
              <img
                src="/logo.jpg"
                alt="Pro Creator"
                className="w-8 h-8 rounded-full object-cover shadow-sm ring-1 ring-white/40"
              />
              <div className="flex flex-col">
                <span className="text-xs font-black leading-tight">Pro Creator</span>
                <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1">
                  ⚡ 2,500 Điểm
                </span>
              </div>
            </div>

            <button
              onClick={onToggleTheme}
              className="box box-hover w-8 h-8 flex items-center justify-center cursor-pointer"
              style={{ '--r': '50%' }}
              title="Đổi giao diện Sáng / Tối"
            >
              <div className="circle-overlay" />
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
          </div>
        </div>
      </aside>

      {/* ================= 2. PHẦN NỘI DUNG CHÍNH (MAIN DASHBOARD VIEW) ================= */}
      <main className="flex-1 h-full overflow-y-auto flex flex-col relative">
        {/* Top Header Bar Cố Định Trong View */}
        <header className="sticky top-0 z-20 px-4 py-3.5 backdrop-blur-xl border-b border-white/20 dark:border-white/5 flex items-center justify-between gap-4">
          {/* Nút Ẩn/Hiện Sidebar đẩy sát bên trái + Thanh tìm kiếm */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setIsSidebarOpen((v) => !v)}
              className={`box box-hover px-3 py-2 flex items-center gap-1.5 text-xs font-extrabold shrink-0 cursor-pointer ${
                isSidebarOpen ? 'active-pill' : ''
              }`}
              style={{ '--r': '999px', width: 'auto' }}
              title={isSidebarOpen ? 'Ẩn Sidebar sang trái' : 'Mở Sidebar'}
            >
              <div className="circle-overlay" />
              <PanelLeft className="w-4 h-4 text-sky-600" />
              <span className="hidden sm:inline">{isSidebarOpen ? 'Ẩn Menu' : 'Menu'}</span>
            </button>

            <div className="box flex-1 max-w-lg px-3.5 py-2 flex items-center gap-2.5" style={{ '--r': '999px' }}>
              <div className="circle-overlay" />
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps, workflows, templates (Tìm kiếm ứng dụng, quy trình tạo ảnh, video)..."
                className="w-full bg-transparent text-xs font-semibold focus:outline-none"
              />
            </div>
          </div>

          {/* Cụm công cụ bên phải */}
          <div className="flex items-center gap-4">
            {/* Đồng hồ số thực tế */}
            <div className="hidden md:flex items-center gap-2 text-xs font-black opacity-75">
              <Clock className="w-3.5 h-3.5 text-sky-500" />
              <span>{clockStr}</span>
            </div>

            {/* Nút Đổi Giao Diện Sáng / Tối */}
            <button
              type="button"
              onClick={onToggleTheme}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
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

            {/* Nút Test Ping AI Engine */}
            <button
              onClick={onPingFlow}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Test Ping AI Engine</span>
            </button>
          </div>
        </header>

        {/* Nội dung trang Dashboard cuộn (SoraTK Flow Style + Kính Quang Học) */}
        <div className="p-6 md:p-8 flex flex-col gap-9 max-w-7xl mx-auto w-full">
          {/* ================= A. HERO BANNER 2 CỘT (SORATK FLOW + LIQUID GLASS) ================= */}
          <div
            className="box relative p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center overflow-hidden shadow-2xl border border-white/40 dark:border-white/10"
            style={{
              '--r': '32px',
              background: isDarkMode
                ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.14) 0%, rgba(16, 185, 129, 0.08) 50%, rgba(15, 23, 42, 0.88) 100%)'
                : 'linear-gradient(135deg, rgba(224, 242, 254, 0.88) 0%, rgba(236, 253, 245, 0.78) 50%, rgba(255, 255, 255, 0.92) 100%)'
            }}
          >
            <div className="circle-overlay" />

            {/* Cột trái: Tiêu đề & CTA */}
            <div className="lg:col-span-6 flex flex-col gap-4 z-10">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black px-3 py-1 rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> AI Studio • Workflow Tự Động
                </span>
                <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {PRESET_TEMPLATES.length} Mẫu Chuẩn Sẵn Sàng
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight text-slate-900 dark:text-white">
                Từ Ảnh Sản Phẩm Đến Video Quảng Cáo — Chỉ Một Quy Trình
              </h1>
              <p className="text-xs md:text-sm font-semibold leading-relaxed text-slate-700 dark:text-slate-300">
                Chọn một quy trình mẫu bên dưới để tự động nhân bản vào kho cá nhân của bạn, hoặc tự tạo sơ đồ Node riêng biệt. Mọi chỉnh sửa và kết quả đều được lưu trữ tách biệt theo từng dự án.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setNewProjectMode('workflow');
                    setShowNewModal(true);
                  }}
                  className="px-5 py-2.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-600 hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Bắt đầu sáng tạo</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onCreateBlankProject({
                      category: 'image',
                      name: 'Bàn vẽ Vô cực (Canvas Inpaint)',
                      workspaceMode: 'freeform'
                    });
                  }}
                  className="box box-hover px-5 py-2.5 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Mở Bàn Vẽ Vô Cực</span>
                </button>
              </div>
            </div>

            {/* Cột phải: 3 Thẻ Showcase Dọc 3:4 So Le (SoraTK Style + Kính Quang Học) */}
            <div className="lg:col-span-6 grid grid-cols-3 gap-3 items-center z-10">
              {heroShowcaseTemplates.map((tpl, idx) => {
                const { videoUrl, imageUrl } = extractCardMedia(tpl);
                const heroKey = `hero-${tpl.id}`;
                const isHeroHovered = hoveredCardId === heroKey;
                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleOpenTemplateCard(tpl)}
                    onMouseEnter={() => setHoveredCardId(heroKey)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    className={`box box-hover relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer group border border-white/40 dark:border-white/15 shadow-xl ${
                      idx === 1 ? '-translate-y-3' : idx === 2 ? 'translate-y-2' : ''
                    }`}
                    style={{ '--r': '20px' }}
                    title={`Dùng mẫu: ${tpl.name}`}
                  >
                    <div className="circle-overlay" />
                    {videoUrl ? (
                      <HoverPreviewVideo
                        src={videoUrl}
                        poster={imageUrl}
                        isHovered={true}
                        isUnmuted={false}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={tpl.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : null}
                    <div className="absolute top-2 left-2 z-10">
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/90 text-white shadow backdrop-blur-md">
                        ▶ Video
                      </span>
                    </div>
                    <div className="absolute bottom-2 left-2 right-2 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 pointer-events-none">
                      <div className="box p-2" style={{ '--r': '14px' }}>
                        <div className="circle-overlay" />
                        <p className="text-[11px] font-black text-slate-900 dark:text-white line-clamp-2 leading-snug">
                          {tpl.name}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ================= B. TIẾP TỤC CHỈNH SỬA • DỰ ÁN CÁ NHÂN & LỊCH SỬ (CÓ THỂ XÓA) ================= */}
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <FolderKanban className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  <span>Tiếp tục chỉnh sửa • Dự án Cá nhân</span>
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setNewProjectMode('workflow');
                    setShowNewModal(true);
                  }}
                  className="box box-hover px-3 py-1 text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  <Plus className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>Tạo dự án mới</span>
                </button>
              </div>

              <span className="box px-3 py-1 text-[11px] font-extrabold opacity-80" style={{ '--r': '999px', width: 'auto' }}>
                <div className="circle-overlay" />
                {personalProjects.length > 0
                  ? `${personalProjects.length} dự án cá nhân đã lưu`
                  : 'Chưa có dự án cá nhân — Hãy bấm vào 1 Mẫu bên dưới để tạo bản sao!'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Thẻ Ngang "+ Tạo Dự Án Mới" (SoraTK Continue Editing Style) */}
              <button
                type="button"
                onClick={() => {
                  setNewProjectMode('workflow');
                  setShowNewModal(true);
                }}
                className="box box-hover h-28 p-4 flex items-center justify-center gap-3 cursor-pointer border-2 border-dashed border-sky-500/35 hover:border-sky-500/70 transition group"
                style={{ '--r': '20px' }}
              >
                <div className="circle-overlay" />
                <div className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-110 transition">
                  <Plus className="w-5 h-5" />
                </div>
                <div className="flex flex-col items-start text-left">
                  <span className="text-xs font-black">New Project</span>
                  <span className="text-[11px] font-semibold opacity-70">Tạo dự án mới từ đầu</span>
                </div>
              </button>

              {/* Danh sách Dự án Cá nhân / Lịch sử đã nhân bản hoặc tự tạo */}
              {personalProjects.map((proj) => {
                const { videoUrl, imageUrl } = extractCardMedia(proj);
                const updatedLabel = proj.updatedAt
                  ? new Date(proj.updatedAt).toLocaleString('vi-VN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      day: '2-digit',
                      month: '2-digit'
                    })
                  : 'Vừa lưu';

                return (
                  <div
                    key={proj.id}
                    onClick={() => onOpenProject(proj)}
                    className="box box-hover h-28 p-3 flex items-center gap-3 cursor-pointer group relative border border-white/30 dark:border-white/10"
                    style={{ '--r': '20px' }}
                  >
                    <div className="circle-overlay" />

                    {/* Thumbnail vuông gọn bên trái */}
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-slate-900/15 dark:bg-slate-950/60 shrink-0 relative">
                      {videoUrl ? (
                        <video
                          src={videoUrl}
                          poster={imageUrl || undefined}
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                      ) : imageUrl ? (
                        <img src={imageUrl} alt={proj.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-sky-500/20 to-indigo-500/20">
                          <Workflow className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                        </div>
                      )}
                    </div>

                    {/* Thông tin & Nút xóa dự án cá nhân */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5 pr-6">
                      <h3 className="text-xs font-black line-clamp-2 leading-snug group-hover:text-sky-600 dark:group-hover:text-sky-400 transition" title={proj.name}>
                        {proj.name}
                      </h3>
                      <div className="flex items-center justify-between text-[10px] font-bold opacity-70">
                        <span>{proj.nodes?.length || 0} Nodes</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {updatedLabel}
                        </span>
                      </div>
                    </div>

                    {/* Nút Xóa (CHỈ hiện trên Dự án Cá nhân) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Xóa dự án cá nhân "${proj.name}" khỏi lịch sử?`)) {
                          onDeleteProject(proj.id);
                        }
                      }}
                      className="absolute top-2.5 right-2.5 z-20 w-7 h-7 rounded-full bg-rose-500/15 hover:bg-rose-500 text-rose-600 hover:text-white flex items-center justify-center transition cursor-pointer"
                      title="Xóa dự án cá nhân này"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ================= C. KHO DỰ ÁN MẪU (TEMPLATES 3:4 - KHÔNG ĐƯỢC XÓA) ================= */}
          <section className="flex flex-col gap-5 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  <span>Dự án Mẫu (Templates)</span>
                </h2>

                <div className="box p-1 flex flex-wrap items-center gap-1 text-xs font-extrabold" style={{ '--r': '999px', width: 'auto' }}>
                  <div className="circle-overlay" />
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className={'box px-3.5 py-1.5 cursor-pointer transition ' + (categoryFilter === 'all' ? 'active-pill' : 'opacity-75')}
                    style={{ '--r': '999px', width: 'auto' }}
                  >
                    <div className="circle-overlay" />
                    Tất cả ({PRESET_TEMPLATES.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('video')}
                    className={'box px-3.5 py-1.5 cursor-pointer transition ' + (categoryFilter === 'video' ? 'active-pill' : 'opacity-75')}
                    style={{ '--r': '999px', width: 'auto' }}
                  >
                    <div className="circle-overlay" />
                    🎬 Video Quảng Cáo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('tryon')}
                    className={'box px-3.5 py-1.5 cursor-pointer transition ' + (categoryFilter === 'tryon' ? 'active-pill' : 'opacity-75')}
                    style={{ '--r': '999px', width: 'auto' }}
                  >
                    <div className="circle-overlay" />
                    👗 Thử Đồ &amp; Lookbook
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('beauty')}
                    className={'box px-3.5 py-1.5 cursor-pointer transition ' + (categoryFilter === 'beauty' ? 'active-pill' : 'opacity-75')}
                    style={{ '--r': '999px', width: 'auto' }}
                  >
                    <div className="circle-overlay" />
                    ✨ Mỹ Phẩm &amp; VFX
                  </button>
                </div>
              </div>

              <span className="box px-3.5 py-1.5 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-300" style={{ '--r': '999px', width: 'auto' }}>
                <div className="circle-overlay" />
                🔒 {filteredTemplates.length} mẫu cố định • Bấm để nhân bản vào Dự án Cá nhân
              </span>
            </div>

            {/* Lưới 4 cột Thẻ Dọc 3:4 chuẩn SoraTK Flow */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filteredTemplates.map((tpl) => {
                const { videoUrl, imageUrl } = extractCardMedia(tpl);
                const isHovered = hoveredCardId === tpl.id;
                const isUnmuted = unmutedCardId === tpl.id;
                const hasVideo = Boolean(videoUrl);

                return (
                  <div
                    key={tpl.id}
                    onClick={() => handleOpenTemplateCard(tpl)}
                    onMouseEnter={() => setHoveredCardId(tpl.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    className="box box-hover relative aspect-[3/4] rounded-[24px] overflow-hidden cursor-pointer group border border-white/35 dark:border-white/10 shadow-xl"
                    style={{ '--r': '24px' }}
                  >
                    <div className="circle-overlay" />

                    {/* Ảnh / Video nền tràn khung 3:4 (Hover vào sẽ tự phát Video) */}
                    {hasVideo ? (
                      <HoverPreviewVideo
                        src={videoUrl}
                        poster={imageUrl}
                        isHovered={isHovered}
                        isUnmuted={isUnmuted}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={tpl.name}
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-500/20 to-indigo-500/20">
                        <Workflow className="w-10 h-10 text-sky-500 opacity-50" />
                      </div>
                    )}

                    {/* Nhãn góc trên trái */}
                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/90 text-white shadow backdrop-blur-md">
                        {tpl.badge || 'Mẫu Chuẩn'}
                      </span>
                    </div>

                    {/* Nút Loa góc trên phải (nếu có video) */}
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnmutedCardId(isUnmuted ? null : tpl.id);
                        }}
                        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/45 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer"
                        title={isUnmuted ? 'Tắt tiếng' : 'Bật tiếng'}
                      >
                        {isUnmuted ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      </button>
                    )}

                    {/* Footer Kính Quang Học (.box) hiện lên mượt mà ở ĐÁY thẻ khi Hover */}
                    <div className="absolute bottom-3 left-3 right-3 z-10 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                      <div className="box p-3 flex flex-col gap-2" style={{ '--r': '18px' }}>
                        <div className="circle-overlay" />
                        <h3 className="text-xs font-black text-slate-900 dark:text-white line-clamp-2 leading-snug" title={tpl.name}>
                          {tpl.name}
                        </h3>
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1 text-[10px] font-extrabold text-slate-700 dark:text-slate-200">
                            <span className="px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/15">
                              {tpl.nodes?.length || 0} Nodes
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/15">
                              {tpl.edges?.length || 0} Dây
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => handleCopyTemplateJson(e, tpl)}
                              className={`px-2 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow transition cursor-pointer ${
                                copiedTemplateId === tpl.id
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-900/75 hover:bg-slate-900 text-white dark:bg-white/20 dark:hover:bg-white/30'
                              }`}
                              title="Sao chép JSON sơ đồ Node của mẫu này để dán vào Nhập JSON"
                            >
                              {copiedTemplateId === tpl.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Đã Copy</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy JSON</span>
                                </>
                              )}
                            </button>
                            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white text-[10px] font-black flex items-center gap-1 shadow">
                              <span>Dùng mẫu</span>
                              <ArrowRight className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {/* ================= 3. MODAL TẠO DỰ ÁN MỚI (LIQUID GLASS MODAL) ================= */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="box w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl" style={{ '--r': '28px' }}>
            <div className="circle-overlay" />

            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-600" />
                Tạo Dự Án Mới (QuanTV AI Studio)
              </h3>
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="box box-hover w-8 h-8 flex items-center justify-center cursor-pointer"
                style={{ '--r': '50%', width: '32px', height: '32px' }}
              >
                <div className="circle-overlay" />
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmNewProject} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black opacity-80">Tên dự án:</label>
                <div className="box px-3.5 py-2 w-full" style={{ '--r': '14px' }}>
                  <div className="circle-overlay" />
                  <input
                    type="text"
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="VD: Lookbook & Video Runway Mùa Đông 7s..."
                    className="w-full bg-transparent text-xs font-semibold focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-black opacity-80">Loại không gian làm việc:</label>
                <div className="grid grid-cols-2 gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => setNewProjectMode('workflow')}
                    className={
                      'box box-hover p-3 flex flex-col gap-1 text-left cursor-pointer transition ' +
                      (newProjectMode === 'workflow' ? 'active-pill ring-2 ring-sky-500' : 'opacity-70')
                    }
                    style={{ '--r': '16px' }}
                  >
                    <div className="circle-overlay" />
                    <span className="text-xs font-black flex items-center gap-1.5 text-sky-600 dark:text-sky-300">
                      <Workflow className="w-3.5 h-3.5" /> Sơ Đồ Node DAG
                    </span>
                    <span className="text-[10px] font-semibold opacity-75">
                      Nối dây tuần tự 4 cột, tự động hoá chạy AI Cloud.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewProjectMode('freeform')}
                    className={
                      'box box-hover p-3 flex flex-col gap-1 text-left cursor-pointer transition ' +
                      (newProjectMode === 'freeform' ? 'active-pill ring-2 ring-sky-500' : 'opacity-70')
                    }
                    style={{ '--r': '16px' }}
                  >
                    <div className="circle-overlay" />
                    <span className="text-xs font-black flex items-center gap-1.5 text-teal-600 dark:text-teal-300">
                      <Layers className="w-3.5 h-3.5" /> Bàn Vẽ Vô Cực
                    </span>
                    <span className="text-[10px] font-semibold opacity-75">
                      Kéo thả ảnh, tách nền, inpainting tự do.
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="box box-hover px-4 py-2 text-xs font-extrabold cursor-pointer"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  Hủy
                </button>
                <button
                  type="submit"
                  className="box box-hover active-pill px-5 py-2 text-xs font-black text-white bg-gradient-to-r from-sky-500 to-indigo-600 cursor-pointer shadow-md"
                  style={{ '--r': '999px', width: 'auto' }}
                >
                  <div className="circle-overlay" />
                  Tạo Dự Án Ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
