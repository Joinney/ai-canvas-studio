import React, { useState, useEffect } from 'react';
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
  Zap
} from 'lucide-react';
import { WINTER_FUR_PROJECT, MIRROR_SELFIE_PROJECT } from '../utils/daCanvasConverter';

// Danh sách các Mẫu Dự Án (Templates) dựng sẵn thực tế chuẩn da-ai-canvas
export const PRESET_TEMPLATES = [
  MIRROR_SELFIE_PROJECT,
  WINTER_FUR_PROJECT
];

export default function HomeDashboard({
  activeTab,
  setActiveTab,
  userProjects,
  onOpenProject,
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

  // Lọc danh sách dự án & templates theo tìm kiếm và danh mục QuanTV
  const allDisplayItems = [
    ...PRESET_TEMPLATES.map((p) => ({ ...p, isPreset: true })),
    ...userProjects.filter((up) => !PRESET_TEMPLATES.some((pt) => pt.id === up.id)).map((p) => ({ ...p, isPreset: false }))
  ];

  const filteredItems = allDisplayItems.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      (item.name || '').toLowerCase().includes(q) ||
      (item.description || '').toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (categoryFilter === 'all') return true;
    if (categoryFilter === 'my-projects') return !item.isPreset;
    if (categoryFilter === 'featured') return item.isPreset;
    if (categoryFilter === 'video') return item.category === 'video' || item.name.toLowerCase().includes('video');
    if (categoryFilter === 'image') return item.category === 'image' || item.name.toLowerCase().includes('thử đồ');
    return true;
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-800 dark:text-slate-100 select-none">
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
                className="box w-11 h-11 flex items-center justify-center shrink-0 cursor-pointer shadow-lg shadow-sky-500/20"
                style={{ '--r': '16px' }}
                onClick={() => {
                  setCurrentModule('dashboard');
                  setCategoryFilter('all');
                }}
              >
                <div className="circle-overlay" />
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-cyan-400 via-sky-500 to-indigo-600 flex items-center justify-center shadow-inner">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
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
            className="box box-hover w-full py-2.5 px-4 flex items-center justify-center gap-2 text-xs font-black text-white bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 shadow-md shadow-sky-500/25 cursor-pointer"
            style={{ '--r': '999px' }}
          >
            <div className="circle-overlay" />
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
                <span>MUSE AI BRIDGE</span>
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
                : '🟠 Chưa phát hiện tab Muse AI'}
            </span>
          </div>

          {/* User Profile & Theme Toggle Card */}
          <div className="box p-3 flex items-center justify-between" style={{ '--r': '16px' }}>
            <div className="circle-overlay" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm">
                AI
              </div>
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

            {/* Nút Test Ping Muse AI */}
            <button
              onClick={onPingFlow}
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Test Ping Muse AI</span>
            </button>

            {/* Nút Hướng Dẫn Sử Dụng QuanTV */}
            <a
              href="https://ai17.quantv.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="box box-hover px-3.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
              style={{ '--r': '999px', width: 'auto' }}
            >
              <div className="circle-overlay" />
              <BookOpen className="w-3.5 h-3.5 text-sky-600" />
              <span>QuanTV Dashboard</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        </header>

        {/* Nội dung trang Dashboard cuộn */}
        <div className="p-8 flex flex-col gap-8 max-w-7xl mx-auto w-full">
          {/* ================= A. HERO BANNER QUANTV (LIQUID GLASS) ================= */}
          <div
            className="box relative p-8 flex flex-col gap-5 overflow-hidden shadow-2xl border border-white/40 dark:border-white/10"
            style={{
              '--r': '32px',
              background: isDarkMode
                ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(99, 102, 241, 0.12) 50%, rgba(15, 23, 42, 0.85) 100%)'
                : 'linear-gradient(135deg, rgba(224, 242, 254, 0.85) 0%, rgba(238, 242, 255, 0.75) 50%, rgba(255, 255, 255, 0.9) 100%)'
            }}
          >
            <div className="circle-overlay" />

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black px-3 py-1 rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> AI Studio • ĐỘT PHÁ TỰ ĐỘNG HÓA WORKFLOW
              </span>
              <span className="text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                Veo 2 & Muse AI Auto-Piping
              </span>
            </div>

            <div className="flex flex-col gap-2 max-w-2xl">
              <h1 className="text-3xl font-black tracking-tight leading-tight">
                AI Canvas Studio — Lookbook &amp; Video Runway 7s 9:16
              </h1>
              <p className="text-xs font-bold leading-relaxed opacity-80">
                Quy trình nối dây đa nhánh tự động hóa từ Ảnh Người Mẫu gốc, Thử đồ 2K đến Video Chuyển động Tự nhiên trên
                Muse AI &amp; Google Flow. Thực thi tuần tự từng bước, đảm bảo an toàn dữ liệu và đồng bộ tức thì.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onOpenProject(MIRROR_SELFIE_PROJECT)}
                className="box box-hover px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-sky-500 to-indigo-600 flex items-center gap-2 shadow-lg shadow-sky-500/30 cursor-pointer"
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                <Play className="w-4 h-4 fill-current" />
                <span>CHẠY NGAY WORKFLOW ĐỐI GƯƠNG 7S</span>
              </button>

              <button
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
                <Layers className="w-4 h-4 text-cyan-600" />
                <span>Mở Bàn Vẽ Vô Cực</span>
              </button>
            </div>
          </div>

          {/* ================= B. KHỐI CÔNG CỤ NHANH QUANTV (4 FEATURE CARDS) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Thử Đồ AI */}
            <div
              onClick={() => {
                setCategoryFilter('image');
                onOpenProject(MIRROR_SELFIE_PROJECT);
              }}
              className="box box-hover p-5 flex flex-col justify-between gap-4 cursor-pointer group"
              style={{ '--r': '24px' }}
            >
              <div className="circle-overlay" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/15 flex items-center justify-center text-teal-600 dark:text-teal-400">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  2K Try-On
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black group-hover:text-teal-600 transition">
                  Image Studio • Thử Đồ 2K
                </h3>
                <p className="text-[11px] font-bold opacity-70 leading-relaxed">
                  Ghép người mẫu &amp; trang phục giữ nguyên dáng đứng đối gương và bối cảnh phòng thực tế.
                </p>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-black text-teal-600">
                <span>Dùng ngay</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Card 2: Tạo Video 9:16 */}
            <div
              onClick={() => {
                setCategoryFilter('video');
                onOpenProject(MIRROR_SELFIE_PROJECT);
              }}
              className="box box-hover p-5 flex flex-col justify-between gap-4 cursor-pointer group"
              style={{ '--r': '24px' }}
            >
              <div className="circle-overlay" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Video className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  9:16 Runway
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black group-hover:text-indigo-600 transition">
                  Video Studio • Video 9:16
                </h3>
                <p className="text-[11px] font-bold opacity-70 leading-relaxed">
                  Sinh video chuyển động tự nhiên 7s mượt mà từ ảnh người mẫu đã thử đồ trên Muse AI.
                </p>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-black text-indigo-600">
                <span>Dùng ngay</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Card 3: Bàn Vẽ Vô Cực */}
            <div
              onClick={() => {
                onCreateBlankProject({
                  category: 'image',
                  name: 'Bàn vẽ Vô cực (Inpaint)',
                  workspaceMode: 'freeform'
                });
              }}
              className="box box-hover p-5 flex flex-col justify-between gap-4 cursor-pointer group"
              style={{ '--r': '24px' }}
            >
              <div className="circle-overlay" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                  <Layers className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                  Inpaint &amp; Mask
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black group-hover:text-cyan-600 transition">
                  Infinite Canvas • Bàn Vẽ Tự Do
                </h3>
                <p className="text-[11px] font-bold opacity-70 leading-relaxed">
                  Bàn vẽ đa tầng không giới hạn, hỗ trợ kéo thả ảnh, tách nền AI, vẽ mask inpainting.
                </p>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-black text-cyan-600">
                <span>Mở bàn vẽ</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </div>

            {/* Card 4: Sơ Đồ Node DAG */}
            <div
              onClick={() => {
                setCategoryFilter('featured');
                onOpenProject(WINTER_FUR_PROJECT);
              }}
              className="box box-hover p-5 flex flex-col justify-between gap-4 cursor-pointer group"
              style={{ '--r': '24px' }}
            >
              <div className="circle-overlay" />
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Workflow className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  DAG Engine
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-black group-hover:text-amber-600 transition">
                  Node Workflow • Sơ Đồ DAG
                </h3>
                <p className="text-[11px] font-bold opacity-70 leading-relaxed">
                  Quy trình 4 cột tự động hóa: nối dây tuần tự, chờ kết quả từng bước, điều phối thông minh.
                </p>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-black text-amber-600">
                <span>Khám phá</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" />
              </div>
            </div>
          </div>

          {/* ================= C. THANH LỌC DANH MỤC QUANTV ================= */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="box p-1 flex items-center gap-1 text-xs font-extrabold" style={{ '--r': '999px', width: 'auto' }}>
              <div className="circle-overlay" />
              <button
                onClick={() => setCategoryFilter('all')}
                className={
                  'box px-4 py-2 cursor-pointer transition ' +
                  (categoryFilter === 'all' ? 'active-pill' : 'opacity-70')
                }
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                All • Tất Cả ({allDisplayItems.length})
              </button>

              <button
                onClick={() => setCategoryFilter('video')}
                className={
                  'box px-4 py-2 cursor-pointer transition ' +
                  (categoryFilter === 'video' ? 'active-pill' : 'opacity-70')
                }
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                🎬 Video Runway 9:16
              </button>

              <button
                onClick={() => setCategoryFilter('image')}
                className={
                  'box px-4 py-2 cursor-pointer transition ' +
                  (categoryFilter === 'image' ? 'active-pill' : 'opacity-70')
                }
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                👗 Thử Đồ &amp; Lookbook
              </button>

              <button
                onClick={() => setCategoryFilter('featured')}
                className={
                  'box px-4 py-2 cursor-pointer transition ' +
                  (categoryFilter === 'featured' ? 'active-pill' : 'opacity-70')
                }
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                🔥 Mẫu Thịnh Hành
              </button>

              <button
                onClick={() => setCategoryFilter('my-projects')}
                className={
                  'box px-4 py-2 cursor-pointer transition ' +
                  (categoryFilter === 'my-projects' ? 'active-pill' : 'opacity-70')
                }
                style={{ '--r': '999px', width: 'auto' }}
              >
                <div className="circle-overlay" />
                📁 Dự Án Của Tôi ({userProjects.length})
              </button>
            </div>

            <div className="text-xs font-bold opacity-60">
              Đang hiển thị <b>{filteredItems.length}</b> dự án &amp; quy trình
            </div>
          </div>

          {/* ================= D. LƯỚI CARDS DỰ ÁN & MẪU (LIQUID GLASS GRID) ================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map((item) => {
              const { videoUrl, imageUrl } = extractCardMedia(item);
              const isHovered = hoveredCardId === item.id;
              const isUnmuted = unmutedCardId === item.id;
              const hasVideo = Boolean(videoUrl);

              return (
                <div
                  key={item.id}
                  onMouseEnter={() => setHoveredCardId(item.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  className="box box-hover p-4 flex flex-col justify-between gap-4 group cursor-pointer border border-white/30 dark:border-white/10"
                  style={{ '--r': '28px' }}
                >
                  <div className="circle-overlay" />

                  {/* Vùng Media Preview (Kính lồng kính) */}
                  <div
                    onClick={() => onOpenProject(item)}
                    className="box relative w-full h-52 flex items-center justify-center overflow-hidden bg-slate-900/10 dark:bg-black/30"
                    style={{ '--r': '20px' }}
                  >
                    <div className="circle-overlay" />

                    {hasVideo ? (
                      <video
                        src={videoUrl}
                        playsInline
                        loop
                        muted={!isUnmuted}
                        autoPlay={isHovered}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <Workflow className="w-8 h-8 text-sky-600" />
                        <span className="text-[11px] font-bold">Quy trình sơ đồ Node</span>
                      </div>
                    )}

                    {/* Badge Nhãn Trên Cùng */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                      {item.isPreset ? (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/90 text-white shadow-sm flex items-center gap-1">
                          <Flame className="w-3 h-3 fill-current" /> MẪU THỊNH HÀNH
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-sky-600/90 text-white shadow-sm flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> DỰ ÁN CỦA BẠN
                        </span>
                      )}
                    </div>

                    {/* Nút Bật/Tắt Tiếng Video Khi Hover */}
                    {hasVideo && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUnmutedCardId(isUnmuted ? null : item.id);
                        }}
                        className="box absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-white z-10 cursor-pointer shadow-md bg-black/50"
                        style={{ '--r': '50%', width: '32px', height: '32px' }}
                        title={isUnmuted ? 'Tắt tiếng' : 'Bật tiếng'}
                      >
                        <div className="circle-overlay" />
                        {isUnmuted ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
                      </button>
                    )}

                    {/* Nút Play Overlay */}
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-10">
                      <div className="w-12 h-12 rounded-full bg-white/90 text-sky-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  {/* Thông Tin & Tiêu Đề Card */}
                  <div className="flex flex-col gap-1.5 px-1">
                    <h3
                      onClick={() => onOpenProject(item)}
                      className="font-black text-sm tracking-tight line-clamp-1 group-hover:text-sky-600 transition"
                      title={item.name}
                    >
                      {item.name}
                    </h3>
                    <p className="text-[11px] font-semibold opacity-70 line-clamp-2 leading-relaxed">
                      {item.description || 'Quy trình tự động hóa thử đồ người mẫu và tạo video runway 9:16.'}
                    </p>
                  </div>

                  {/* Footer Card: Số Node, Dây Nối & Nút Hành Động */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/20 dark:border-white/5">
                    <div className="flex items-center gap-2 text-[10px] font-black opacity-75">
                      <span className="px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        {item.nodes?.length || 0} Nodes
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        {item.edges?.length || 0} Dây nối
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!item.isPreset && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Bạn có chắc chắn muốn xóa dự án "${item.name}"?`)) {
                              onDeleteProject(item.id);
                            }
                          }}
                          className="box box-hover w-7 h-7 flex items-center justify-center text-rose-500 cursor-pointer"
                          style={{ '--r': '50%', width: '28px', height: '28px' }}
                          title="Xóa dự án này"
                        >
                          <div className="circle-overlay" />
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenProject(item)}
                        className="box box-hover px-3 py-1.5 text-xs font-black text-sky-700 dark:text-sky-300 flex items-center gap-1 cursor-pointer"
                        style={{ '--r': '999px', width: 'auto' }}
                      >
                        <div className="circle-overlay" />
                        <span>Mở Dự Án</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                      Nối dây tuần tự 4 cột, tự động hoá chạy Muse AI.
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
