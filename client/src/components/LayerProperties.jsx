import React from 'react';
import { Sliders, Sun, Shield, Eye, Play, Pause } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

export default function LayerProperties() {
  const { images, selectedId, updateImage } = useCanvasStore();
  const selectedImg = images.find((i) => i.id === selectedId);

  if (!selectedImg) {
    return (
      <div className="fixed right-4 bottom-36 bg-zinc-900/85 backdrop-blur-md border border-white/10 p-3 rounded-2xl w-64 z-10 shadow-2xl text-xs text-zinc-500 text-center">
        Chọn một layer ảnh hoặc video để chỉnh thuộc tính
      </div>
    );
  }

  const handleChange = (field, val) => {
    updateImage(selectedId, { [field]: Number(val) });
  };

  const toggleVideoPlay = () => {
    updateImage(selectedId, { isPlaying: selectedImg.isPlaying === false ? true : false });
  };

  return (
    <div className="fixed right-4 bottom-36 bg-zinc-900/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl w-64 z-10 shadow-2xl flex flex-col gap-2.5">
      <div className="flex items-center justify-between text-xs font-semibold text-zinc-200 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-1.5 truncate">
          <Sliders className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-indigo-300 truncate">{selectedImg.name}</span>
        </div>
        {selectedImg.type === 'video' && (
          <button
            onClick={toggleVideoPlay}
            className="px-2 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 flex items-center gap-1 text-[11px] cursor-pointer shrink-0 transition"
          >
            {selectedImg.isPlaying === false ? (
              <>
                <Play className="w-3 h-3" /> Phát
              </>
            ) : (
              <>
                <Pause className="w-3 h-3" /> Dừng
              </>
            )}
          </button>
        )}
      </div>

      {/* Độ sáng (chỉ áp dụng cho ảnh) */}
      {selectedImg.type !== 'video' && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Sun className="w-3.5 h-3.5 text-amber-400" /> Độ sáng
            </span>
            <span>{selectedImg.brightness || 0}</span>
          </div>
          <input
            type="range"
            min="-100"
            max="100"
            value={selectedImg.brightness || 0}
            onChange={(e) => handleChange('brightness', e.target.value)}
            className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg"
          />
        </div>
      )}

      {/* Độ nhòe bóng đổ (Shadow Blur) */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-indigo-400" /> Độ nhòe bóng đổ
          </span>
          <span>{selectedImg.shadowBlur ?? 15}px</span>
        </div>
        <input
          type="range"
          min="0"
          max="50"
          value={selectedImg.shadowBlur ?? 15}
          onChange={(e) => handleChange('shadowBlur', e.target.value)}
          className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg"
        />
      </div>

      {/* Độ đậm bóng đổ (Shadow Opacity) */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-emerald-400" /> Độ đậm bóng
          </span>
          <span>{Math.round((selectedImg.shadowOpacity ?? 0.5) * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={selectedImg.shadowOpacity ?? 0.5}
          onChange={(e) => handleChange('shadowOpacity', e.target.value)}
          className="w-full accent-indigo-500 h-1.5 bg-zinc-800 rounded-lg"
        />
      </div>
    </div>
  );
}
