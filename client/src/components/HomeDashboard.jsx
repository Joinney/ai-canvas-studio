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
  VolumeX
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
  const [hoveredCardId, setHoveredCardId] = useState(null);
  const [unmutedCardId, setUnmutedCardId] = useState(null);

  // Hàm trích xuất Video & Ảnh đại diện từ bất kỳ Dự án / Mẫu nào
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

  const filteredPresets = PRESET_TEMPLATES.filter((t) => {
    const matchTab = activeTab === 'my-projects' ? true : t.category === activeTab;
    const matchSearch =
      !searchQuery.trim() ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const filteredUserProjects = userProjects.filter((p) => {
    const matchTab = activeTab === 'my-projects' ? true : p.category === activeTab;
    const matchSearch =
      !searchQuery.trim() ||
      (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const handleConfirmNewProject = (e) => {
    e.preventDefault();
    const title =
      newProjectTitle.trim() ||
      (activeTab === 'video' ? 'Dự án Workflow Video mới' : 'Dự án Hình ảnh mới');
    onCreateBlankProject({
      category: activeTab === 'image' ? 'image' : 'video',
      name: title,
      workspaceMode: newProjectMode
    });
    setNewProjectTitle('');
    setShowNewModal(false);
  };

  return (
    <div className="w-screen h-screen overflow-y-auto px-6 py-5 select-none">
      <div className="max-w-[1440px] mx-auto flex flex-col gap-6 pb-12">
        {/* ================= 1. HEADER KÍNH QUANG HỌC (.box) ================= */}
        <header className="box px-7 h-[62px] flex items-center justify-between" style={{ '--r': '28px' }}>
          <div className="circle-overlay" />

          {/* Vầng sáng góc trái Header */}
          <div
            className="absolute -left-4 top-1/2 -translate-y-1/2 w-14 h-14 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(14, 165, 233, 0.9) 0%, rgba(56, 189, 248, 0.35) 55%, transparent 80%)',
              filter: 'blur(4px)'
            }}
          />

          <div className="w-full flex items-center justify-between">
            {/* Thương hiệu */}
            <div className="flex items-center gap-3 font-extrabold text-lg tracking-tight">
              <div className="box w-9 h-9 flex items-center justify-center" style={{ '--r': '50%' }}>
                <div className="circle-overlay" />
                <Workflow className="w-4 h-4 text-sky-600" />
              </div>
              <span>AI CANVAS STUDIO</span>
            </div>

            {/* Thanh Nav Pill giữa Header */}
            <div className="nav-links-box">
              <button
                onClick={() => setActiveTab('video')}
                className={'nav-pill-item ' + (activeTab === 'video' ? 'active' : '')}
              >
                <Video className="w-3.5 h-3.5" /> Tạo Video
              </button>
              <button
                onClick={() => setActiveTab('image')}
                className={'nav-pill-item ' + (activeTab === 'image' ? 'active' : '')}
              >
                <ImageIcon className="w-3.5 h-3.5" /> Tạo Hình Ảnh
              </button>
              <button
                onClick={() => setActiveTab('my-projects')}
                className={'nav-pill-item ' + (activeTab === 'my-projects' ? 'active' : '')}
              >
                <FolderKanban className="w-3.5 h-3.5" /> Dự Án Của Tôi ({userProjects.length})
              </button>
            </div>

            {/* Cụm nút Kính tròn bên phải Header */}
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenApiConfig}
                title="Cấu hình API Key"
                className="box box-hover w-9 h-9 flex items-center justify-center cursor-pointer"
                style={{ '--r': '50%' }}
              >
                <div className="circle-overlay" />
                <Settings className="w-4 h-4 text-sky-600" />
              </button>

              <button
                onClick={onToggleTheme}
                title="Đổi giao diện Sáng / Tối Kính Quang Học"
                className="box box-hover w-9 h-9 flex items-center justify-center cursor-pointer"
                style={{ '--r': '50%' }}
              >
                <div className="circle-overlay" />
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-sky-600" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ================= 2. BỐ CỤC 2 CỘT: SIDEBAR KÍNH + MAIN KÍNH ================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[330px_1fr] gap-6 items-start">
          {/* CỘT SIDEBAR TRÁI (KÍNH LẤY KÍNH) */}
          <aside className="flex flex-col gap-6">
            {/* Thẻ Profile & Điều hướng Sidebar (.box lớn chứa các .box con) */}
            <div className="box p-6 flex flex-col gap-5" style={{ '--r': '28px' }}>
              <div className="circle-overlay" />

              {/* Avatar Kính Tròn */}
              <div className="flex flex-col items-center text-center gap-2">
                <div className="box w-24 h-24 flex items-center justify-center" style={{ '--r': '50%' }}>
                  <div className="circle-overlay" />
                  <Sparkles className="w-10 h-10 text-sky-600" />
                </div>

                <h2 className="font-black text-xl tracking-tight mt-1">AI WORKFLOW HUB</h2>
                <span className="text-[11px] font-bold uppercase tracking-widest opacity-60">
                  OPTICAL GLASS • GOOGLE FLOW
                </span>

                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-black/5 border border-black/10">
                    Veo 2 Video
                  </span>
                  <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-black/5 border border-black/10">
                    Imagen 3
                  </span>
                  <span className="text-[11px] font-bold px-3 py-0.5 rounded-full bg-black/5 border border-black/10">
                    Multi-Tab
                  </span>
                </div>
              </div>

              {/* Nút Kính + Tạo Dự Án Mới */}
              <button
                onClick={() => {
                  setNewProjectMode('workflow');
                  setShowNewModal(true);
                }}
                className="box box-hover w-full h-11 flex items-center justify-center gap-2 text-xs font-black text-sky-700 cursor-pointer"
                style={{ '--r': '999px' }}
              >
                <div className="circle-overlay" />
                <Plus className="w-4 h-4" />
                <span>+ TẠO DỰ ÁN WORKFLOW MỚI</span>
              </button>

              {/* Các Tab Sidebar bằng .box (Kính lồng Kính) */}
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setActiveTab('video')}
                  className={
                    'box box-hover w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold cursor-pointer ' +
                    (activeTab === 'video' ? 'ring-2 ring-sky-500/60' : '')
                  }
                  style={{ '--r': '18px' }}
                >
                  <div className="circle-overlay" />
                  <div className="flex items-center gap-2.5">
                    <Video className="w-4 h-4 text-sky-600" />
                    <span>Tạo Video (AI Video)</span>
                  </div>
                  <span className="text-[10px] font-black opacity-70">
                    {PRESET_TEMPLATES.filter((t) => t.category === 'video').length} mẫu
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('image')}
                  className={
                    'box box-hover w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold cursor-pointer ' +
                    (activeTab === 'image' ? 'ring-2 ring-sky-500/60' : '')
                  }
                  style={{ '--r': '18px' }}
                >
                  <div className="circle-overlay" />
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="w-4 h-4 text-teal-600" />
                    <span>Tạo Hình Ảnh (AI Image)</span>
                  </div>
                  <span className="text-[10px] font-black opacity-70">
                    {PRESET_TEMPLATES.filter((t) => t.category === 'image').length} mẫu
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('my-projects')}
                  className={
                    'box box-hover w-full px-4 py-3 flex items-center justify-between text-xs font-extrabold cursor-pointer ' +
                    (activeTab === 'my-projects' ? 'ring-2 ring-sky-500/60' : '')
                  }
                  style={{ '--r': '18px' }}
                >
                  <div className="circle-overlay" />
                  <div className="flex items-center gap-2.5">
                    <FolderKanban className="w-4 h-4 text-indigo-600" />
                    <span>Dự Án Của Tôi</span>
                  </div>
                  <span className="text-[10px] font-black opacity-70">
                    {userProjects.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Khối Kính Trạng Thái Muse AI & Flow Bridge (.box chứa .box) */}
            <div className="box p-5 flex flex-col gap-3.5" style={{ '--r': '28px' }}>
              <div className="circle-overlay" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black">
                  <span
                    className={
                      'w-2.5 h-2.5 rounded-full ' +
                      (flowStatus.connected ? 'bg-emerald-500' : 'bg-amber-500')
                    }
                  />
                  <span>MUSE AI & FLOW BRIDGE</span>
                </div>
                <button
                  onClick={onCheckFlow}
                  className="box box-hover w-8 h-8 flex items-center justify-center cursor-pointer"
                  style={{ '--r': '50%' }}
                >
                  <div className="circle-overlay" />
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="box p-3.5 text-xs font-bold leading-relaxed" style={{ '--r': '18px' }}>
                <div className="circle-overlay" />
                <span>
                  {flowStatus.connected
                    ? `🟢 Đã kết nối (${flowStatus.openFlowTabs || 1} tab Muse AI / Flow sẵn sàng)`
                    : '🟠 Chưa phát hiện tab Muse AI / Flow'}
                </span>
              </div>

              {pingMessage && (
                <div className="text-[11px] font-bold text-emerald-700 px-2">
                  {pingMessage}
                </div>
              )}

              <button
                onClick={onPingFlow}
                className="box box-hover w-full h-10 flex items-center justify-center gap-2 text-xs font-extrabold cursor-pointer"
                style={{ '--r': '999px' }}
              >
                <div className="circle-overlay" />
                <span>⚡ Test Ping Google Flow</span>
              </button>
            </div>

            {/* Khối Uptime Glass (.box) */}
            <div className="box p-5 flex flex-col items-center text-center gap-1" style={{ '--r': '28px' }}>
              <div className="circle-overlay" />
              <span className="text-[11px] font-extrabold uppercase tracking-widest opacity-60">
                PROJECTS STORED ON DISK
              </span>
              <span className="text-2xl font-black">
                {userProjects.length} SAVED • {PRESET_TEMPLATES.length} PRESETS
              </span>
            </div>
          </aside>

          {/* CỘT CHÍNH BÊN PHẢI */}
          <main className="flex flex-col gap-6">
            {/* Hàng Controls & Đồng hồ Kính (.controls-row) */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setActiveTab('video')}
                  className={
                    'box box-hover h-10 px-5 flex items-center gap-2 text-xs font-extrabold cursor-pointer ' +
                    (activeTab === 'video' ? 'ring-2 ring-sky-500/50' : '')
                  }
                  style={{ '--r': '999px' }}
                >
                  <div className="circle-overlay" />
                  <Video className="w-3.5 h-3.5 text-sky-600" />
                  <span>Workflow Tạo Video</span>
                </button>

                <button
                  onClick={() => setActiveTab('image')}
                  className={
                    'box box-hover h-10 px-5 flex items-center gap-2 text-xs font-extrabold cursor-pointer ' +
                    (activeTab === 'image' ? 'ring-2 ring-sky-500/50' : '')
                  }
                  style={{ '--r': '999px' }}
                >
                  <div className="circle-overlay" />
                  <ImageIcon className="w-3.5 h-3.5 text-teal-600" />
                  <span>Workflow Tạo Hình Ảnh</span>
                </button>

                <button
                  onClick={() => {
                    setNewProjectMode('workflow');
                    setShowNewModal(true);
                  }}
                  className="box box-hover h-10 px-5 flex items-center gap-2 text-xs font-black text-sky-700 cursor-pointer"
                  style={{ '--r': '999px' }}
                >
                  <div className="circle-overlay" />
                  <Plus className="w-4 h-4" />
                  <span>+ Tạo Dự Án Mới</span>
                </button>
              </div>

              {/* Đồng hồ Kính Quang Học (.clock-box) */}
              <div className="box h-10 px-5 flex items-center justify-center" style={{ '--r': '999px' }}>
                <div className="circle-overlay" />
                <span className="font-mono text-sm font-black italic tracking-widest">
                  {clockStr}
                </span>
              </div>
            </div>

            {/* KHỐI KÍNH LỚN 1: DANH SÁCH DỰ ÁN MẪU (KÍNH LẤY KÍNH - .box trong .box) */}
            <section className="box p-7 flex flex-col gap-6" style={{ '--r': '28px' }}>
              <div className="circle-overlay" />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <h3 className="source-title-bar text-lg font-black">
                  {activeTab === 'video'
                    ? 'DANH SÁCH DỰ ÁN TẠO VIDEO SẴN CÓ'
                    : activeTab === 'image'
                    ? 'DANH SÁCH DỰ ÁN TẠO HÌNH ẢNH SẴN CÓ'
                    : 'TẤT CẢ MẪU WORKFLOW'}
                </h3>

                {/* Ô tìm kiếm Kính (.search-mini-box) */}
                <div className="box w-64 h-10 px-4 flex items-center gap-2" style={{ '--r': '999px' }}>
                  <div className="circle-overlay" />
                  <Search className="w-3.5 h-3.5 opacity-60 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm dự án..."
                    className="bg-transparent border-none outline-none text-xs font-bold w-full"
                  />
                </div>
              </div>

              {/* Lưới 3 cột các thẻ Kính (.box lồng bên trong .box!) */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredPresets.map((tpl) => {
                  const savedProj = userProjects.find((p) => p.id === tpl.id) || tpl;
                  const cardKey = `preset-${tpl.id}`;
                  const isHovered = hoveredCardId === cardKey;
                  const isUnmuted = unmutedCardId === cardKey;
                  const { videoUrl, imageUrl } = extractCardMedia(savedProj);

                  return (
                    <div
                      key={tpl.id}
                      onMouseEnter={() => setHoveredCardId(cardKey)}
                      onMouseLeave={() => setHoveredCardId(null)}
                      onClick={() =>
                        onOpenProject({
                          ...savedProj,
                          id: savedProj.id === 'proj-winter-velvet-luxe-fur' ? savedProj.id : 'proj-' + Date.now(),
                          nodes: JSON.parse(JSON.stringify(savedProj.nodes || [])),
                          edges: JSON.parse(JSON.stringify(savedProj.edges || [])),
                          stickers: JSON.parse(JSON.stringify(savedProj.stickers || [])),
                          updatedAt: new Date().toISOString()
                        })
                      }
                      className="box box-hover p-4 flex flex-col justify-between gap-3.5 cursor-pointer"
                      style={{ '--r': '22px' }}
                    >
                      <div className="circle-overlay" />

                      {/* Thumbnail Kính bên trong thẻ Kính (Hover là tự động phát Video!) */}
                      <div
                        className="box w-full h-44 p-1.5 flex flex-col items-center justify-center relative overflow-hidden"
                        style={{ '--r': '16px' }}
                      >
                        <div className="circle-overlay" />

                        {isHovered && videoUrl ? (
                          <>
                            <video
                              src={videoUrl}
                              autoPlay
                              loop
                              muted={!isUnmuted}
                              playsInline
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnmutedCardId(isUnmuted ? null : cardKey);
                              }}
                              className="box absolute bottom-2.5 left-2.5 w-7 h-7 flex items-center justify-center text-white bg-slate-900/70 z-20 cursor-pointer"
                              style={{ '--r': '50%', width: '28px', height: '28px' }}
                              title={isUnmuted ? 'Tắt tiếng' : 'Bật tiếng nhạc nền'}
                            >
                              <div className="circle-overlay" />
                              {isUnmuted ? (
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <VolumeX className="w-3.5 h-3.5 text-white" />
                              )}
                            </button>
                          </>
                        ) : imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={tpl.name}
                            className="w-full h-full object-cover rounded-xl opacity-95"
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="box px-2.5 py-1 text-[10px] font-black" style={{ '--r': '10px' }}>
                              <div className="circle-overlay" />
                              <span>Cột 1</span>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                            <div className="box px-2.5 py-1 text-[10px] font-black" style={{ '--r': '10px' }}>
                              <div className="circle-overlay" />
                              <span>Cột 2: 3D</span>
                            </div>
                            {tpl.category === 'video' && (
                              <>
                                <ArrowRight className="w-3.5 h-3.5 text-teal-600" />
                                <div className="box px-2.5 py-1 text-[10px] font-black text-sky-700" style={{ '--r': '10px' }}>
                                  <div className="circle-overlay" />
                                  <span>Veo 2</span>
                                </div>
                              </>
                            )}
                          </div>
                        )}

                        <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold z-10">
                          {isHovered && videoUrl ? '▶ Đang phát Video Preview' : tpl.badge}
                        </span>

                        {videoUrl && !isHovered && (
                          <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[9px] font-extrabold z-10 flex items-center gap-1">
                            <Play className="w-2.5 h-2.5 fill-current" /> Rê chuột xem Video
                          </span>
                        )}

                        <span className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-sky-600 text-white text-[9px] font-black z-10">
                          {tpl.techTag || 'FLOW'}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 px-1">
                        <h4 className="font-extrabold text-sm leading-snug">
                          {tpl.name}
                        </h4>
                        <p className="text-xs opacity-75 line-clamp-2 leading-relaxed font-medium">
                          {tpl.description}
                        </p>
                      </div>

                      <div className="pt-2 px-1 flex items-center justify-between text-xs font-extrabold opacity-80">
                        <span>
                          {tpl.workspaceMode === 'freeform'
                            ? 'Bàn vẽ Inpaint'
                            : `${tpl.nodes.length} Nodes${tpl.stickers?.length ? ` • ${tpl.stickers.length} Ghi chú` : ''}`}
                        </span>
                        <span className="text-sky-700 flex items-center gap-1">
                          <Play className="w-3.5 h-3.5 fill-current" /> Mở Dự Án
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* KHỐI KÍNH LỚN 2: DỰ ÁN TỰ TẠO CỦA BẠN (KÍNH LẤY KÍNH) */}
            <section className="box p-7 flex flex-col gap-6" style={{ '--r': '28px' }}>
              <div className="circle-overlay" />

              <div className="flex items-center justify-between">
                <h3 className="source-title-bar text-lg font-black">
                  DỰ ÁN TÙY CHỈNH CỦA BẠN ({filteredUserProjects.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {/* Thẻ Kính Tạo Dự Án Mới */}
                <div
                  onClick={() => {
                    setNewProjectMode('workflow');
                    setShowNewModal(true);
                  }}
                  className="box box-hover p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[240px] cursor-pointer"
                  style={{ '--r': '22px' }}
                >
                  <div className="circle-overlay" />
                  <div className="box w-14 h-14 flex items-center justify-center" style={{ '--r': '50%' }}>
                    <div className="circle-overlay" />
                    <Plus className="w-6 h-6 text-sky-600" />
                  </div>
                  <span className="font-black text-sm">
                    + Tự Tạo Dự Án {activeTab === 'image' ? 'Hình Ảnh' : 'Video'} Mới
                  </span>
                  <span className="text-xs opacity-70 font-medium">
                    Tự thêm các Node Cột 1, 2, 3, 4 và kéo dây theo ý muốn
                  </span>
                </div>

                {filteredUserProjects.map((proj) => {
                  const cardKey = `user-${proj.id}`;
                  const isHovered = hoveredCardId === cardKey;
                  const isUnmuted = unmutedCardId === cardKey;
                  const { videoUrl, imageUrl } = extractCardMedia(proj);

                  return (
                    <div
                      key={proj.id}
                      onMouseEnter={() => setHoveredCardId(cardKey)}
                      onMouseLeave={() => setHoveredCardId(null)}
                      onClick={() => onOpenProject(proj)}
                      className="box box-hover p-4 flex flex-col justify-between gap-3 cursor-pointer"
                      style={{ '--r': '22px' }}
                    >
                      <div className="circle-overlay" />

                      {/* Khung Kính Preview Video khi Hover cho Dự Án Của Bạn */}
                      <div
                        className="box w-full h-40 p-1.5 flex items-center justify-center relative overflow-hidden"
                        style={{ '--r': '16px' }}
                      >
                        <div className="circle-overlay" />
                        {isHovered && videoUrl ? (
                          <>
                            <video
                              src={videoUrl}
                              autoPlay
                              loop
                              muted={!isUnmuted}
                              playsInline
                              className="w-full h-full object-cover rounded-xl"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setUnmutedCardId(isUnmuted ? null : cardKey);
                              }}
                              className="box absolute bottom-2 left-2 w-7 h-7 flex items-center justify-center text-white bg-slate-900/70 z-20 cursor-pointer"
                              style={{ '--r': '50%', width: '28px', height: '28px' }}
                              title={isUnmuted ? 'Tắt tiếng' : 'Bật tiếng'}
                            >
                              <div className="circle-overlay" />
                              {isUnmuted ? (
                                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <VolumeX className="w-3.5 h-3.5 text-white" />
                              )}
                            </button>
                          </>
                        ) : imageUrl ? (
                          <img
                            src={imageUrl}
                            alt={proj.name}
                            className="w-full h-full object-cover rounded-xl opacity-95"
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-xs font-extrabold opacity-70">
                            <Workflow className="w-4 h-4 text-sky-600" />
                            <span>{proj.nodes?.length || 0} Nodes Workflow</span>
                          </div>
                        )}

                        <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold z-10">
                          {isHovered && videoUrl
                            ? '▶ Đang phát Video'
                            : proj.workspaceMode === 'freeform'
                            ? 'Bàn vẽ Inpaint'
                            : `${proj.nodes?.length || 0} Nodes`}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProject(proj.id);
                          }}
                          className="box absolute top-2 right-2 w-7 h-7 flex items-center justify-center hover:text-red-500 cursor-pointer z-20"
                          style={{ '--r': '50%', width: '28px', height: '28px' }}
                          title="Xóa dự án"
                        >
                          <div className="circle-overlay" />
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex flex-col gap-1 px-1">
                        <h4 className="font-black text-sm leading-snug">{proj.name}</h4>
                        <p className="text-xs opacity-70 line-clamp-2 font-medium">
                          {proj.description || 'Dự án Workflow tùy chỉnh của bạn.'}
                        </p>
                      </div>

                      <div className="pt-1 px-1 flex items-center justify-between text-xs font-extrabold opacity-80">
                        <span>{new Date(proj.updatedAt || Date.now()).toLocaleTimeString('vi-VN')}</span>
                        <span className="text-sky-700 flex items-center gap-1">
                          Mở Bàn Vẽ <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
      </div>

      {/* Modal Kính Quang Học Khởi tạo Dự án mới */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/25 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="box w-full max-w-md p-6 flex flex-col gap-4" style={{ '--r': '28px' }}>
            <div className="circle-overlay" />
            <h3 className="font-black text-base">
              Khởi Tạo Dự Án {activeTab === 'image' ? 'Hình Ảnh' : 'Video'} Mới
            </h3>

            <form onSubmit={handleConfirmNewProject} className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold opacity-80">Tên dự án của bạn:</label>
                <div className="box px-4 py-2.5" style={{ '--r': '16px' }}>
                  <div className="circle-overlay" />
                  <input
                    type="text"
                    autoFocus
                    value={newProjectTitle}
                    onChange={(e) => setNewProjectTitle(e.target.value)}
                    placeholder="VD: Lookbook Thời Trang Thu Đông..."
                    className="bg-transparent border-none outline-none text-sm font-bold w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-extrabold opacity-80">Chọn chế độ bàn vẽ:</label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setNewProjectMode('workflow')}
                    className={
                      'box box-hover p-3.5 cursor-pointer flex flex-col gap-1 ' +
                      (newProjectMode === 'workflow' ? 'ring-2 ring-sky-500' : 'opacity-70')
                    }
                    style={{ '--r': '18px' }}
                  >
                    <div className="circle-overlay" />
                    <div className="font-black flex items-center gap-1.5 text-sky-700">
                      <Workflow className="w-4 h-4" /> Sơ đồ Node
                    </div>
                    <p className="text-[11px] opacity-75 font-medium">
                      Thêm Node Cột 1, 2, 3, 4 và kéo dây tự do.
                    </p>
                  </div>

                  <div
                    onClick={() => setNewProjectMode('freeform')}
                    className={
                      'box box-hover p-3.5 cursor-pointer flex flex-col gap-1 ' +
                      (newProjectMode === 'freeform' ? 'ring-2 ring-sky-500' : 'opacity-70')
                    }
                    style={{ '--r': '18px' }}
                  >
                    <div className="circle-overlay" />
                    <div className="font-black flex items-center gap-1.5 text-teal-700">
                      <Layers className="w-4 h-4" /> Bàn vẽ Inpaint
                    </div>
                    <p className="text-[11px] opacity-75 font-medium">
                      Vẽ cọ Mask Inpaint và tách nền trực tiếp.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="box box-hover px-5 py-2 text-xs font-extrabold cursor-pointer"
                  style={{ '--r': '999px' }}
                >
                  <div className="circle-overlay" />
                  <span>Hủy</span>
                </button>
                <button
                  type="submit"
                  className="box box-hover px-6 py-2 text-xs font-black text-sky-700 cursor-pointer"
                  style={{ '--r': '999px' }}
                >
                  <div className="circle-overlay" />
                  <span>Tạo &amp; Mở Bàn Vẽ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
