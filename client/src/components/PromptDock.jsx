import React, { useState } from 'react';
import {
  Wand2,
  Scissors,
  Sparkles,
  Loader2,
  Download,
  Video,
  Film,
  Images,
  ArrowRightLeft,
  AtSign,
  BookOpen
} from 'lucide-react';
import { removeBackground } from '@imgly/background-removal';
import { useCanvasStore } from '../store/useCanvasStore';
import { generateAIImage, inpaintAIImage, generateAIVideo } from '../services/api';

const MOTION_PRESETS = [
  { id: 'cinematic_zoom', label: '🎥 Zoom' },
  { id: 'floating_3d', label: '✨ Nổi 3D' },
  { id: 'pan_showcase', label: '↔️ Lia máy' },
  { id: 'pulse_glow', label: '⚡ Neon' }
];

const SEEDANCE_MODELS = [
  { id: 'seedance-2.0-mini', label: '✨ Toàn năng 2.0 - Mini (seedance-mini)' },
  { id: 'seedance-2.0', label: '🚀 Seedance 2.0 (Đa phương thức)' },
  { id: 'seedance-v1-lite', label: '⚡ Seedance 1.0 Lite (Nhanh)' },
  { id: 'seedance-v1-pro', label: '🎬 Seedance 1.0 Pro (Điện ảnh)' }
];

const FEISHU_CASE_TEMPLATES = [
  {
    id: 'case1',
    name: '案例1: Thay mẫu + trang phục',
    prompt: 'Cinematic fashion video, the model from @Ảnh1 wearing the outfit and product from @Ảnh2, natural walking movement, studio lighting'
  },
  {
    id: 'case3',
    name: '案例3: Thay sản phẩm (Giày/Đồ)',
    prompt: 'Commercial product showcase video of @Ảnh2 in outdoor natural sunlight, smooth camera orbit, realistic shadows and reflections, 4K'
  },
  {
    id: 'case4',
    name: '案例4: Người mẫu giới thiệu (口播)',
    prompt: 'The person in @Ảnh1 speaking naturally to the camera with lifelike facial expressions and hand gestures while presenting @Ảnh2'
  },
  {
    id: 'case5',
    name: '案例5: Remix Video (视频二创)',
    prompt: 'Realistic subject motion combining the character from @Ảnh1 and the product from @Ảnh2, smooth camera tracking, lifelike physics'
  }
];

const ensureSendableImageUrl = async (url) => {
  if (!url || !url.startsWith('blob:')) return url;
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export default function PromptDock({ exportMaskBase64 }) {
  const [prompt, setPrompt] = useState(
    'Cinematic commercial video, subject in @Ảnh1 moving naturally with product @Ảnh2, realistic studio lighting, smooth camera push-in'
  );
  const [statusText, setStatusText] = useState('');
  const {
    images,
    selectedId,
    maskLines,
    motionLines,
    motionType,
    setMotionType,
    videoGenMode,
    setVideoGenMode,
    videoModel,
    setVideoModel,
    videoResolution,
    setVideoResolution,
    videoAspectRatio,
    setVideoAspectRatio,
    videoDuration,
    setVideoDuration,
    refImageIds,
    toggleRefImageId,
    refVideoId,
    setRefVideoId,
    startFrameId,
    setStartFrameId,
    endFrameId,
    setEndFrameId,
    addImage,
    clearMasks,
    isLoading,
    setIsLoading,
    setTool
  } = useCanvasStore();

  const selectedImg = images.find((i) => i.id === selectedId);
  const imageNodes = images.filter((i) => i.type !== 'video');
  const videoNodes = images.filter((i) => i.type === 'video');

  const insertTagToPrompt = (tag) => {
    setPrompt((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  const handleAutoWritePrompt = () => {
    const autoPrompts = [
      'Cinematic commercial video, camera slowly orbits around the subject from @Ảnh1 and product @Ảnh2, realistic physics, natural hair and fabric movement, 4k studio lighting',
      'Lifelike product advertisement: person in @Ảnh1 naturally interacting with @Ảnh2, smooth camera push-in, soft bokeh background, photorealistic motion',
      'Dynamic studio showcase: @Ảnh2 comes alive with realistic reflections and smooth 3D rotation in the environment of @Ảnh1, high definition commercial shot'
    ];
    const picked = autoPrompts[Math.floor(Math.random() * autoPrompts.length)];
    setPrompt(picked);
  };

  const handleGenerate = async (customPrompt) => {
    const finalPrompt = customPrompt || prompt || 'Commercial product studio photography';
    setIsLoading(true);
    setStatusText('Đang tạo ảnh AI...');
    try {
      let url;
      if (maskLines.length > 0 && selectedImg) {
        url = await inpaintAIImage({ prompt: finalPrompt, imageUrl: selectedImg.url, maskBase64: exportMaskBase64() });
      } else {
        url = await generateAIImage(finalPrompt);
      }
      addImage({
        id: 'ai-' + Date.now(),
        type: 'image',
        name: 'Ảnh AI ' + (images.length + 1),
        url,
        x: selectedImg ? selectedImg.x + selectedImg.width + 60 : 450,
        y: selectedImg ? selectedImg.y : 140,
        width: 280,
        height: 340
      });
      clearMasks();
    } catch (e) {
      alert('Lỗi AI: ' + e.message);
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  // Tạo Video AI THẬT 100% qua Cloud GPU / Seedance API (Không dùng giả lập Canvas)
  const handleGenerateVideo = async () => {
    setIsLoading(true);
    try {
      const mentionedNodes = imageNodes.filter((n) => prompt.includes(n.tag));
      let activeRefNodes =
        mentionedNodes.length > 0
          ? mentionedNodes
          : imageNodes.filter((n) => refImageIds.includes(n.id));

      if (activeRefNodes.length === 0 && selectedImg && selectedImg.type !== 'video') {
        activeRefNodes = [selectedImg];
      }

      if (activeRefNodes.length === 0 && imageNodes.length === 0) {
        setStatusText('Bước 1/2: Đang tạo khung hình AI...');
        const generatedUrl = await generateAIImage(prompt || 'Luxury commercial product shot, 8k');
        activeRefNodes = [{ id: 'temp', url: generatedUrl }];
      } else if (activeRefNodes.length === 0) {
        activeRefNodes = imageNodes.slice(0, 2);
      }

      const startNode = imageNodes.find((n) => n.id === startFrameId) || activeRefNodes[0];
      const endNode = imageNodes.find((n) => n.id === endFrameId) || activeRefNodes[1] || null;
      const refVideoNode = videoNodes.find((n) => n.id === refVideoId);

      setStatusText('Đang tải ảnh lên Cloud GPU & render Video AI thật (15-40s)...');

      const sendableRefUrls = await Promise.all(
        activeRefNodes.map((n) => ensureSendableImageUrl(n.url))
      );
      const sendableStartUrl = startNode ? await ensureSendableImageUrl(startNode.url) : sendableRefUrls[0];
      const sendableEndUrl =
        videoGenMode === 'frames' && endNode ? await ensureSendableImageUrl(endNode.url) : null;

      const res = await generateAIVideo({
        prompt,
        genMode: videoGenMode,
        imageUrl: sendableStartUrl,
        endImageUrl: sendableEndUrl,
        referenceImageUrls: sendableRefUrls,
        referenceVideoUrl: refVideoNode ? refVideoNode.url : null,
        model: videoModel,
        resolution: videoResolution,
        aspectRatio: videoAspectRatio,
        duration: videoDuration,
        motionType: motionLines.length > 0 ? 'motion_path' : motionType
      });

      if (!res || !res.videoUrl) {
        throw new Error(res?.message || 'Server không trả về URL video AI.');
      }

      let nodeW = 300;
      let nodeH = 300;
      if (videoAspectRatio === '9:16') {
        nodeW = 240;
        nodeH = 426;
      } else if (videoAspectRatio === '16:9') {
        nodeW = 426;
        nodeH = 240;
      }

      const sourceIds =
        videoGenMode === 'frames'
          ? [startNode?.id, endNode?.id].filter(Boolean)
          : [
              ...activeRefNodes.map((n) => n.id),
              refVideoNode?.id
            ].filter((id) => id && id !== 'temp');

      const rightmostX =
        images.length > 0 ? Math.max(...images.map((i) => i.x + i.width)) : 400;
      const avgY =
        images.length > 0
          ? Math.round(images.reduce((acc, i) => acc + i.y, 0) / images.length)
          : 120;

      addImage({
        id: 'vid-seedance-' + Date.now(),
        type: 'video',
        name: `AI Video (${res.endpoint || res.mode})`,
        url: res.videoUrl,
        x: rightmostX + 110,
        y: avgY,
        width: nodeW,
        height: nodeH,
        isPlaying: true,
        sourceNodeIds: [...new Set(sourceIds)]
      });

      clearMasks();
      setTool('select');
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      alert('Lỗi tạo Video AI thật: ' + msg);
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  const handleRemoveBg = async () => {
    if (!selectedImg || selectedImg.type === 'video') {
      return alert('Hãy click chọn 1 bức ảnh trên bàn vẽ trước!');
    }
    setIsLoading(true);
    setStatusText('Đang tách nền AI...');
    try {
      const blob = await removeBackground(selectedImg.url);
      const url = URL.createObjectURL(blob);
      addImage({
        id: 'nobg-' + Date.now(),
        type: 'image',
        name: 'Tách nền ' + selectedImg.tag,
        url,
        x: selectedImg.x + selectedImg.width + 60,
        y: selectedImg.y,
        width: selectedImg.width,
        height: selectedImg.height
      });
    } catch (e) {
      alert('Lỗi tách nền: ' + e.message);
    } finally {
      setIsLoading(false);
      setStatusText('');
    }
  };

  const handleDownloadSelected = () => {
    if (!selectedImg) return alert('Hãy chọn ảnh hoặc video cần tải về!');
    const a = document.createElement('a');
    a.href = selectedImg.url;
    a.target = '_blank';
    const ext = selectedImg.type === 'video' ? 'mp4' : 'png';
    a.download = `seedance-${selectedImg.tag || 'media'}-${Date.now()}.${ext}`;
    a.click();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/95 backdrop-blur-xl border border-white/15 p-3.5 rounded-2xl w-[880px] max-w-[96vw] z-10 shadow-2xl flex flex-col gap-2.5">
      {/* HÀNG 1: Chuyển đổi Chế độ (@Tham chiếu / Khung Đầu-Cuối) + Tác vụ nhanh */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setVideoGenMode('reference')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition ${
              videoGenMode === 'reference'
                ? 'bg-zinc-800 text-white shadow-sm border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Images className="w-3.5 h-3.5 text-purple-400" />
            Tham chiếu (@参考)
          </button>
          <button
            onClick={() => setVideoGenMode('frames')}
            className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition ${
              videoGenMode === 'frames'
                ? 'bg-zinc-800 text-white shadow-sm border border-purple-500/40'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-pink-400" />
            Khung Đầu - Cuối (首尾帧)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleRemoveBg}
            disabled={isLoading}
            className="bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
            title="Tách nền sản phẩm/nhân vật (抠图)"
          >
            <Scissors className="w-3.5 h-3.5 text-indigo-400" /> Tách nền
          </button>
          <button
            onClick={handleAutoWritePrompt}
            disabled={isLoading}
            className="bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
            title="Tự động viết kịch bản chuẩn theo các Node trên Canvas (一键代为撰写)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> AI Tự Viết Prompt
          </button>
          <button
            onClick={handleDownloadSelected}
            className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition"
          >
            <Download className="w-3.5 h-3.5" />
            {selectedImg?.type === 'video' ? `Tải ${selectedImg.tag} (.mp4)` : 'Tải file'}
          </button>
        </div>
      </div>

      {/* HÀNG 2: Khu vực chọn Node Tham chiếu trên Canvas + Kịch bản mẫu Feishu */}
      <div className="flex flex-col gap-2 bg-zinc-950/80 border border-white/10 p-2.5 rounded-xl">
        {videoGenMode === 'reference' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-zinc-400 flex items-center gap-1 mr-1">
                <AtSign className="w-3.5 h-3.5 text-purple-400" /> Chọn Node tham chiếu:
              </span>
              {imageNodes.map((node) => {
                const active = refImageIds.includes(node.id);
                return (
                  <div key={node.id} className="flex items-center">
                    <button
                      onClick={() => toggleRefImageId(node.id)}
                      className={`px-2 py-1 rounded-l-lg border flex items-center gap-1.5 cursor-pointer transition ${
                        active
                          ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <img src={node.url} alt="" className="w-4 h-4 rounded object-cover" />
                      <span>{node.tag}</span>
                    </button>
                    <button
                      onClick={() => insertTagToPrompt(node.tag)}
                      className="px-1.5 py-1 rounded-r-lg bg-zinc-800 hover:bg-purple-600 text-[10px] text-zinc-300 hover:text-white border border-l-0 border-zinc-700 cursor-pointer transition"
                    >
                      +Chèn
                    </button>
                  </div>
                );
              })}

              {videoNodes.length > 0 && (
                <select
                  value={refVideoId || ''}
                  onChange={(e) => setRefVideoId(e.target.value || null)}
                  className="bg-zinc-900 border border-purple-500/40 text-purple-200 rounded-lg px-2 py-1 text-xs cursor-pointer"
                >
                  <option value="">-- Không dùng Video mẫu --</option>
                  {videoNodes.map((v) => (
                    <option key={v.id} value={v.id}>
                      🎥 Tham chiếu: {v.tag} ({v.name})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-amber-400" /> Mẫu:
              </span>
              {FEISHU_CASE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setPrompt(tpl.prompt)}
                  className="text-[11px] bg-zinc-800/90 hover:bg-purple-600/30 hover:text-purple-200 text-zinc-300 border border-white/5 px-2 py-0.5 rounded-md cursor-pointer transition"
                >
                  {tpl.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-purple-300 font-medium">🟢 Khung hình Đầu (Start Frame):</span>
              <select
                value={startFrameId || ''}
                onChange={(e) => setStartFrameId(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-2.5 py-1 text-xs cursor-pointer"
              >
                {imageNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.tag} - {n.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-pink-300 font-medium">🏁 Khung hình Cuối (End Frame):</span>
              <select
                value={endFrameId || ''}
                onChange={(e) => setEndFrameId(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 text-white rounded-lg px-2.5 py-1 text-xs cursor-pointer"
              >
                {imageNodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.tag} - {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerateVideo()}
            placeholder="Mô tả nội dung & chuyển động video (khuyến khích tiếng Anh hoặc bấm AI Tự Viết Prompt)..."
            className="flex-1 bg-zinc-900/90 border border-zinc-700/80 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-purple-500 text-white"
          />
          <button
            onClick={() => handleGenerate()}
            disabled={isLoading}
            className="bg-zinc-800 hover:bg-zinc-700 border border-white/10 disabled:opacity-50 px-3.5 py-2 rounded-xl font-medium text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-indigo-400" />}
            {maskLines.length > 0 ? 'Sửa vùng Mask' : 'Tạo Ảnh Mới'}
          </button>
          <button
            onClick={handleGenerateVideo}
            disabled={isLoading}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 px-5 py-2 rounded-xl font-semibold text-sm flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-purple-600/30 transition"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
            {isLoading ? statusText || 'Đang xử lý AI...' : 'Tạo Video AI Thật'}
          </button>
        </div>
      </div>

      {/* HÀNG 3: Thanh cấu hình Model + Tỷ lệ khung hình + Độ phân giải */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={videoModel}
            onChange={(e) => setVideoModel(e.target.value)}
            className="bg-zinc-950 border border-purple-500/40 text-purple-200 font-medium rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-purple-400 cursor-pointer"
          >
            {SEEDANCE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="flex items-center bg-zinc-950 border border-zinc-800 rounded-xl px-2 py-1 gap-1.5">
            <select
              value={videoResolution}
              onChange={(e) => setVideoResolution(e.target.value)}
              className="bg-transparent text-zinc-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="720p" className="bg-zinc-900">720p</option>
              <option value="1080p" className="bg-zinc-900">1080p</option>
            </select>
            <span className="text-zinc-600">•</span>
            <select
              value={videoAspectRatio}
              onChange={(e) => setVideoAspectRatio(e.target.value)}
              className="bg-transparent text-zinc-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="9:16" className="bg-zinc-900">9:16 (TikTok/Shorts)</option>
              <option value="16:9" className="bg-zinc-900">16:9 (Ngang)</option>
              <option value="1:1" className="bg-zinc-900">1:1 (Vuông)</option>
            </select>
            <span className="text-zinc-600">•</span>
            <select
              value={videoDuration}
              onChange={(e) => setVideoDuration(e.target.value)}
              className="bg-transparent text-zinc-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="4" className="bg-zinc-900">4s</option>
              <option value="5" className="bg-zinc-900">5s</option>
              <option value="10" className="bg-zinc-900">10s</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Film className="w-3.5 h-3.5 text-purple-400 mr-0.5" />
          {MOTION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setMotionType(preset.id)}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                motionType === preset.id && motionLines.length === 0
                  ? 'bg-purple-600 text-white font-medium'
                  : 'bg-zinc-800/80 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
