import React from 'react';
import { MousePointer, Hand, Brush, Navigation, Eraser, Trash2, Upload, ArrowUp, ArrowDown } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

export default function Toolbar() {
  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    clearMasks,
    deleteSelected,
    addImage,
    bringForward,
    sendBackward,
    motionLines
  } = useCanvasStore();

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');

    if (isVideo) {
      const url = URL.createObjectURL(file);
      addImage({
        id: 'vid-' + Date.now(),
        type: 'video',
        name: '🎬 ' + file.name.slice(0, 14),
        url,
        x: 380,
        y: 160,
        width: 340,
        height: 340
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) =>
      addImage({
        id: 'img-' + Date.now(),
        type: 'image',
        name: file.name.slice(0, 15),
        url: ev.target.result,
        x: 380,
        y: 160,
        width: 340,
        height: 340
      });
    reader.readAsDataURL(file);
  };

  const btn = (t, activeColor = 'bg-indigo-600 text-white') =>
    'p-2.5 rounded-xl transition cursor-pointer ' +
    (tool === t ? activeColor : 'hover:bg-zinc-800 text-zinc-300');

  return (
    <>
      <div className="fixed left-4 top-1/2 -translate-y-1/2 bg-zinc-900/85 backdrop-blur-md border border-white/10 p-2 rounded-2xl flex flex-col gap-2 z-10 shadow-2xl">
        <button onClick={() => setTool('select')} className={btn('select')} title="Chọn & Di chuyển">
          <MousePointer className="w-5 h-5" />
        </button>
        <button onClick={() => setTool('pan')} className={btn('pan')} title="Kéo bàn vẽ">
          <Hand className="w-5 h-5" />
        </button>
        <button onClick={() => setTool('brush')} className={btn('brush')} title="Cọ vẽ Mask Inpaint">
          <Brush className="w-5 h-5" />
        </button>
        <button
          onClick={() => setTool('motion')}
          className={btn('motion', 'bg-purple-600 text-white shadow-lg shadow-purple-600/30')}
          title="Vẽ hướng chuyển động cho Video AI (Motion Brush)"
        >
          <Navigation className="w-5 h-5" />
        </button>

        <hr className="border-zinc-800 my-1" />

        <label className="p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-300 cursor-pointer" title="Tải Ảnh hoặc Video lên bàn vẽ">
          <Upload className="w-5 h-5" />
          <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
        </label>
        <button onClick={bringForward} className="p-2.5 rounded-xl hover:bg-zinc-800 text-emerald-400 cursor-pointer" title="Đưa lên lớp trên">
          <ArrowUp className="w-5 h-5" />
        </button>
        <button onClick={sendBackward} className="p-2.5 rounded-xl hover:bg-zinc-800 text-amber-400 cursor-pointer" title="Đưa xuống lớp dưới">
          <ArrowDown className="w-5 h-5" />
        </button>

        <hr className="border-zinc-800 my-1" />

        <button onClick={clearMasks} className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 cursor-pointer" title="Xóa vùng Mask & Đường chuyển động">
          <Eraser className="w-5 h-5" />
        </button>
        <button onClick={deleteSelected} className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 cursor-pointer" title="Xóa Layer đang chọn">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {tool === 'brush' && (
        <div className="fixed left-20 top-1/2 -translate-y-1/2 bg-zinc-900/90 border border-white/10 px-4 py-3 rounded-xl flex flex-col gap-2 z-10">
          <span className="text-xs text-zinc-400">
            Cỡ cọ Mask: <b className="text-white">{brushSize}px</b>
          </span>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-32 accent-indigo-500"
          />
        </div>
      )}

      {tool === 'motion' && (
        <div className="fixed left-20 top-1/2 -translate-y-1/2 bg-zinc-900/95 border border-purple-500/30 px-4 py-3 rounded-xl flex flex-col gap-1.5 z-10 max-w-[230px] shadow-xl">
          <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5" /> Cọ Vẽ Quỹ Đạo Video AI
          </span>
          <span className="text-[11px] text-zinc-400 leading-relaxed">
            Kéo chuột trên ảnh để vẽ mũi tên hướng di chuyển, sau đó bấm <b>Tạo Video AI</b> ở thanh dưới!
          </span>
          {motionLines.length > 0 && (
            <button
              onClick={clearMasks}
              className="mt-1 text-[11px] bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 py-1 px-2 rounded-lg cursor-pointer transition"
            >
              Xóa đường vẽ ({motionLines.length})
            </button>
          )}
        </div>
      )}
    </>
  );
}
