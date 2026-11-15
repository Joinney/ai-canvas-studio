import React from 'react';
import { Layers, ArrowUp, ArrowDown, Trash2, Video } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

export default function LayerPanel() {
  const { images, selectedId, setSelectedId, bringForward, sendBackward, deleteSelected } = useCanvasStore();

  return (
    <div className="fixed right-4 top-20 bg-zinc-900/85 backdrop-blur-md border border-white/10 p-3 rounded-2xl w-64 z-10 shadow-2xl flex flex-col gap-2">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
          <Layers className="w-4 h-4 text-indigo-400" /> Quản lý Layers ({images.length})
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={bringForward}
            disabled={!selectedId}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 cursor-pointer transition"
            title="Đưa lên lớp trên (Đè lên nền)"
          >
            <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
          </button>
          <button
            onClick={sendBackward}
            disabled={!selectedId}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 cursor-pointer transition"
            title="Đưa xuống lớp dưới (Làm nền)"
          >
            <ArrowDown className="w-3.5 h-3.5 text-amber-400" />
          </button>
          <button
            onClick={deleteSelected}
            disabled={!selectedId}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-red-500/20 disabled:opacity-40 cursor-pointer transition"
            title="Xóa Layer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>

      {/* Hiển thị từ trên xuống dưới theo thứ tự lớp trên cùng -> lớp dưới cùng */}
      <div className="flex flex-col gap-1.5 max-h-60 overflow-y-auto pr-1">
        {[...images].reverse().map((img, idx) => {
          const isSelected = img.id === selectedId;
          const isVideo = img.type === 'video';
          return (
            <div
              key={img.id}
              onClick={() => setSelectedId(img.id)}
              className={`flex items-center gap-2.5 p-1.5 rounded-xl cursor-pointer border transition ${
                isSelected
                  ? isVideo
                    ? 'bg-purple-600/25 border-purple-500/60 text-white'
                    : 'bg-indigo-600/25 border-indigo-500/60 text-white'
                  : 'bg-zinc-950/50 border-transparent hover:bg-zinc-800/70 text-zinc-400'
              }`}
            >
              {isVideo ? (
                <div className="w-9 h-9 rounded-lg bg-purple-900/50 border border-purple-500/40 flex items-center justify-center shrink-0">
                  <Video className="w-4 h-4 text-purple-300" />
                </div>
              ) : (
                <img
                  src={img.url}
                  alt="thumb"
                  className="w-9 h-9 rounded-lg object-cover bg-zinc-800 border border-white/10 shrink-0"
                />
              )}
              <div className="flex flex-col overflow-hidden">
                <span className="text-xs font-medium truncate">
                  <b className="text-purple-300 mr-1">{img.tag}</b>
                  {img.name || 'Layer'}
                </span>
                <span className="text-[10px] text-zinc-500">
                  {isVideo ? 'Video Seedance • ' : ''}
                  {idx === 0 ? 'Lớp trên cùng' : idx === images.length - 1 ? 'Lớp nền dưới' : `Lớp #${images.length - idx}`}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
