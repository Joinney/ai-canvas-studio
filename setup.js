const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = __dirname;
const write = (relPath, content) => {
  const full = path.join(root, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.trim() + '\n', 'utf8');
  console.log('✅ Đã tạo:', relPath);
};

// ================= 1. TẠO SERVER (PORT 5001) =================
write('server/.env', `PORT=5001\nFAL_KEY=`);

write('server/package.json', JSON.stringify({
  name: "server",
  version: "1.0.0",
  main: "src/index.js",
  scripts: {
    start: "node src/index.js",
    dev: "nodemon src/index.js"
  },
  dependencies: {
    "@fal-ai/client": "^1.2.0",
    "axios": "^1.7.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "multer": "^1.4.5-lts.1"
  },
  devDependencies: {
    "nodemon": "^3.1.0"
  }
}, null, 2));

write('server/src/services/fal.service.js', `
const { fal } = require('@fal-ai/client');
if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });

exports.generateImage = async (prompt) => {
  if (process.env.FAL_KEY) {
    const r = await fal.subscribe('fal-ai/flux/schnell', { input: { prompt, image_size: 'square_hd' } });
    return r.data.images[0].url;
  }
  const seed = Math.floor(Math.random() * 999999);
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=768&height=768&seed=' + seed + '&nologo=true';
};

exports.inpaintImage = async ({ prompt, imageUrl, maskBase64 }) => {
  if (process.env.FAL_KEY) {
    const r = await fal.subscribe('fal-ai/flux-general/inpainting', {
      input: { prompt, image_url: imageUrl, mask_url: maskBase64 }
    });
    return r.data.images[0].url;
  }
  const seed = Math.floor(Math.random() * 999999);
  return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt + ', seamless studio inpaint') + '?width=768&height=768&seed=' + seed + '&nologo=true';
};

exports.removeBackground = async ({ imageUrl }) => {
  if (process.env.FAL_KEY) {
    const r = await fal.subscribe('fal-ai/birefnet', { input: { image_url: imageUrl } });
    return r.data.image.url;
  }
  return imageUrl;
};
`);

write('server/src/controllers/ai.controller.js', `
const falService = require('../services/fal.service');

exports.generate = async (req, res) => {
  try {
    const imageUrl = await falService.generateImage(req.body.prompt || 'Studio product photography');
    res.json({ success: true, imageUrl });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.inpaint = async (req, res) => {
  try {
    const imageUrl = await falService.inpaintImage(req.body);
    res.json({ success: true, imageUrl });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.removeBg = async (req, res) => {
  try {
    const imageUrl = await falService.removeBackground(req.body);
    res.json({ success: true, imageUrl });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
`);

write('server/src/routes/ai.routes.js', `
const express = require('express');
const router = express.Router();
const c = require('../controllers/ai.controller');

router.post('/generate', c.generate);
router.post('/inpaint', c.inpaint);
router.post('/remove-bg', c.removeBg);

module.exports = router;
`);

write('server/src/index.js', `
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const aiRoutes = require('./routes/ai.routes');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.use('/api/ai', aiRoutes);
app.get('/health', (req, res) => res.json({ status: 'OK', service: 'AI Canvas Studio Backend', port: 5001 }));

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log('🚀 Server AI Canvas đang chạy tại http://localhost:' + PORT));
`);

// ================= 2. TẠO CLIENT (REACT + VITE + KONVA) =================
write('client/package.json', JSON.stringify({
  name: "client",
  private: true,
  version: "0.0.0",
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview"
  },
  dependencies: {
    "axios": "^1.7.0",
    "clsx": "^2.1.1",
    "konva": "^9.3.16",
    "lucide-react": "^0.454.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-konva": "^18.2.10",
    "zustand": "^5.0.1"
  },
  devDependencies: {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.3",
    "tailwindcss": "^4.0.0",
    "vite": "^5.4.10"
  }
}, null, 2));

write('client/vite.config.js', `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`);

write('client/index.html', `
<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Studio Canvas</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`);

write('client/src/index.css', `
@import "tailwindcss";
body {
  margin: 0;
  overflow: hidden;
  background-color: #121214;
  color: #fff;
  font-family: Inter, system-ui, sans-serif;
}
`);

write('client/src/main.jsx', `
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
`);

write('client/src/services/api.js', `
import axios from 'axios';
const api = axios.create({ baseURL: 'http://localhost:5001/api/ai' });

export const generateAIImage = async (prompt) => (await api.post('/generate', { prompt })).data.imageUrl;
export const inpaintAIImage = async (payload) => (await api.post('/inpaint', payload)).data.imageUrl;
export const removeBgAIImage = async (imageUrl) => (await api.post('/remove-bg', { imageUrl })).data.imageUrl;
`);

write('client/src/store/useCanvasStore.js', `
import { create } from 'zustand';

export const useCanvasStore = create((set) => ({
  tool: 'select',
  brushSize: 35,
  zoom: 1,
  stagePos: { x: 0, y: 0 },
  images: [
    {
      id: 'sample-1',
      url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
      x: 420,
      y: 140,
      width: 340,
      height: 340
    }
  ],
  selectedId: 'sample-1',
  maskLines: [],
  isLoading: false,
  setTool: (tool) => set({ tool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setZoom: (zoom) => set({ zoom }),
  setStagePos: (stagePos) => set({ stagePos }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setIsLoading: (isLoading) => set({ isLoading }),
  addImage: (newImg) => set((s) => ({ images: [...s.images, newImg], selectedId: newImg.id })),
  updateImage: (id, attrs) => set((s) => ({ images: s.images.map((i) => (i.id === id ? { ...i, ...attrs } : i)) })),
  deleteSelected: () => set((s) => ({ images: s.images.filter((i) => i.id !== s.selectedId), selectedId: null })),
  addMaskLine: (line) => set((s) => ({ maskLines: [...s.maskLines, line] })),
  updateLastMaskLine: (points) => set((s) => {
    const u = [...s.maskLines];
    if (u.length) u[u.length - 1].points = points;
    return { maskLines: u };
  }),
  clearMasks: () => set({ maskLines: [] }),
}));
`);

write('client/src/components/Toolbar.jsx', `
import React from 'react';
import { MousePointer, Hand, Brush, Eraser, Trash2, Upload } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';

export default function Toolbar() {
  const { tool, setTool, brushSize, setBrushSize, clearMasks, deleteSelected, addImage } = useCanvasStore();

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => addImage({ id: 'img-' + Date.now(), url: ev.target.result, x: 380, y: 160, width: 340, height: 340 });
    reader.readAsDataURL(file);
  };

  const btn = (t) => 'p-2.5 rounded-xl transition cursor-pointer ' + (tool === t ? 'bg-indigo-600 text-white' : 'hover:bg-zinc-800 text-zinc-300');

  return (
    <>
      <div className="fixed left-4 top-1/2 -translate-y-1/2 bg-zinc-900/85 backdrop-blur-md border border-white/10 p-2 rounded-2xl flex flex-col gap-2 z-10 shadow-2xl">
        <button onClick={() => setTool('select')} className={btn('select')} title="Chọn & Di chuyển"><MousePointer className="w-5 h-5"/></button>
        <button onClick={() => setTool('pan')} className={btn('pan')} title="Kéo bàn vẽ"><Hand className="w-5 h-5"/></button>
        <button onClick={() => setTool('brush')} className={btn('brush')} title="Cọ vẽ Mask Inpaint"><Brush className="w-5 h-5"/></button>
        <hr className="border-zinc-800 my-1"/>
        <label className="p-2.5 rounded-xl hover:bg-zinc-800 text-zinc-300 cursor-pointer" title="Tải ảnh lên">
          <Upload className="w-5 h-5"/>
          <input type="file" accept="image/*" onChange={handleUpload} className="hidden"/>
        </label>
        <button onClick={clearMasks} className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 cursor-pointer" title="Xóa vùng Mask"><Eraser className="w-5 h-5"/></button>
        <button onClick={deleteSelected} className="p-2.5 rounded-xl hover:bg-red-500/20 text-red-400 cursor-pointer" title="Xóa ảnh đang chọn"><Trash2 className="w-5 h-5"/></button>
      </div>
      {tool === 'brush' && (
        <div className="fixed left-20 top-1/2 -translate-y-1/2 bg-zinc-900/90 border border-white/10 px-4 py-3 rounded-xl flex flex-col gap-2 z-10">
          <span className="text-xs text-zinc-400">Cỡ cọ: <b className="text-white">{brushSize}px</b></span>
          <input type="range" min="5" max="100" value={brushSize} onChange={(e) => setBrushSize(Number(e.target.value))} className="w-32 accent-indigo-500"/>
        </div>
      )}
    </>
  );
}
`);

write('client/src/components/PromptDock.jsx', `
import React, { useState } from 'react';
import { Wand2, Scissors, Maximize2, Sparkles, Loader2 } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { generateAIImage, inpaintAIImage, removeBgAIImage } from '../services/api';

export default function PromptDock({ exportMaskBase64 }) {
  const [prompt, setPrompt] = useState('');
  const { images, selectedId, maskLines, addImage, clearMasks, isLoading, setIsLoading } = useCanvasStore();
  const selectedImg = images.find((i) => i.id === selectedId);

  const handleGenerate = async (customPrompt) => {
    const finalPrompt = customPrompt || prompt || 'Commercial product studio photography';
    setIsLoading(true);
    try {
      let url;
      if (maskLines.length > 0 && selectedImg) {
        url = await inpaintAIImage({ prompt: finalPrompt, imageUrl: selectedImg.url, maskBase64: exportMaskBase64() });
      } else {
        url = await generateAIImage(finalPrompt);
      }
      addImage({
        id: 'ai-' + Date.now(),
        url,
        x: selectedImg ? selectedImg.x + selectedImg.width + 40 : 450,
        y: selectedImg ? selectedImg.y : 160,
        width: 340,
        height: 340
      });
      clearMasks();
    } catch (e) {
      alert('Lỗi AI: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveBg = async () => {
    if (!selectedImg) return alert('Hãy chọn 1 ảnh trước!');
    setIsLoading(true);
    try {
      const url = await removeBgAIImage(selectedImg.url);
      addImage({
        id: 'nobg-' + Date.now(),
        url,
        x: selectedImg.x + selectedImg.width + 40,
        y: selectedImg.y,
        width: selectedImg.width,
        height: selectedImg.height
      });
    } catch (e) {
      alert(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/85 backdrop-blur-md border border-white/10 p-3 rounded-2xl w-[650px] max-w-[92vw] z-10 shadow-2xl flex flex-col gap-2.5">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-400 px-1">Tác vụ nhanh:</span>
        <button onClick={handleRemoveBg} disabled={isLoading} className="bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer"><Scissors className="w-3.5 h-3.5 text-indigo-400"/> Tách nền</button>
        <button onClick={() => handleGenerate('Expanded wide studio background, 8k')} disabled={isLoading} className="bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer"><Maximize2 className="w-3.5 h-3.5 text-emerald-400"/> Mở rộng ảnh</button>
        <button onClick={() => handleGenerate('Ultra HD 8k sharp commercial product shot')} disabled={isLoading} className="bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded-md flex items-center gap-1.5 cursor-pointer"><Sparkles className="w-3.5 h-3.5 text-amber-400"/> Tăng nét HD</button>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          placeholder={maskLines.length > 0 ? 'Mô tả vùng cần sửa (Inpaint)...' : 'Mô tả ảnh muốn tạo...'}
          className="flex-1 bg-zinc-950/90 border border-zinc-700/80 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 text-white"
        />
        <button onClick={() => handleGenerate()} disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 cursor-pointer">
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Wand2 className="w-4 h-4"/>}
          {isLoading ? 'Đang xử lý...' : maskLines.length > 0 ? 'Inpaint' : 'Tạo ảnh'}
        </button>
      </div>
    </div>
  );
}
`);

write('client/src/components/InfiniteCanvas.jsx', `
import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Transformer } from 'react-konva';
import { useCanvasStore } from '../store/useCanvasStore';

function URLImage({ imageProps, isSelected, onSelect, onChange, draggable }) {
  const [img, setImg] = useState(null);
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    const i = new window.Image();
    i.crossOrigin = 'Anonymous';
    i.src = imageProps.url;
    i.onload = () => setImg(i);
  }, [imageProps.url]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={img}
        x={imageProps.x}
        y={imageProps.y}
        width={imageProps.width}
        height={imageProps.height}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const n = shapeRef.current;
          const sx = n.scaleX();
          const sy = n.scaleY();
          n.scaleX(1);
          n.scaleY(1);
          onChange({ x: n.x(), y: n.y(), width: Math.max(40, n.width() * sx), height: Math.max(40, n.height() * sy) });
        }}
      />
      {isSelected && <Transformer ref={trRef} borderStroke="#6366f1" anchorStroke="#6366f1" anchorSize={9} borderDash={[4, 4]}/>}
    </>
  );
}

export default function InfiniteCanvas({ maskLayerRef }) {
  const isDrawing = useRef(false);
  const { tool, brushSize, zoom, stagePos, setZoom, setStagePos, images, selectedId, setSelectedId, updateImage, maskLines, addMaskLine, updateLastMaskLine } = useCanvasStore();

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
    const newScale = Math.max(0.15, Math.min(e.evt.deltaY < 0 ? oldScale * 1.08 : oldScale / 1.08, 5));
    setZoom(newScale);
    setStagePos({ x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale });
  };

  const handleMouseDown = (e) => {
    if (tool === 'select' && e.target === e.target.getStage()) return setSelectedId(null);
    if (tool !== 'brush') return;
    isDrawing.current = true;
    const pos = e.target.getStage().getRelativePointerPosition();
    addMaskLine({ points: [pos.x, pos.y], brushSize });
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current || tool !== 'brush') return;
    const pos = e.target.getStage().getRelativePointerPosition();
    const last = maskLines[maskLines.length - 1];
    if (last) updateLastMaskLine(last.points.concat([pos.x, pos.y]));
  };

  return (
    <div
      className="w-screen h-screen"
      style={{
        backgroundImage: 'radial-gradient(#2e2e34 1.5px, transparent 1.5px)',
        backgroundSize: (24 * zoom) + 'px ' + (24 * zoom) + 'px',
        backgroundPosition: stagePos.x + 'px ' + stagePos.y + 'px',
        cursor: tool === 'pan' ? 'grab' : tool === 'brush' ? 'crosshair' : 'default'
      }}
    >
      <Stage
        width={window.innerWidth}
        height={window.innerHeight}
        draggable={tool === 'pan'}
        scaleX={zoom}
        scaleY={zoom}
        x={stagePos.x}
        y={stagePos.y}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => (isDrawing.current = false)}
        onDragEnd={(e) => e.target === e.target.getStage() && setStagePos({ x: e.target.x(), y: e.target.y() })}
      >
        <Layer>
          {images.map((img) => (
            <URLImage
              key={img.id}
              imageProps={img}
              isSelected={img.id === selectedId && tool === 'select'}
              draggable={tool === 'select'}
              onSelect={() => setSelectedId(img.id)}
              onChange={(a) => updateImage(img.id, a)}
            />
          ))}
        </Layer>
        <Layer ref={maskLayerRef}>
          {maskLines.map((l, i) => (
            <Line key={i} points={l.points} stroke="rgba(99, 102, 241, 0.6)" strokeWidth={l.brushSize} tension={0.5} lineCap="round" lineJoin="round"/>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
`);

write('client/src/App.jsx', `
import React, { useRef } from 'react';
import InfiniteCanvas from './components/InfiniteCanvas';
import Toolbar from './components/Toolbar';
import PromptDock from './components/PromptDock';
import { useCanvasStore } from './store/useCanvasStore';

export default function App() {
  const maskLayerRef = useRef(null);
  const { zoom } = useCanvasStore();

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none">
      <div className="fixed top-4 left-4 bg-zinc-900/85 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-3 z-10 shadow-lg">
        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse"/>
        <span className="font-semibold text-sm">AI Studio Canvas</span>
        <span className="text-xs text-zinc-400 border-l border-zinc-700 pl-3">{Math.round(zoom * 100)}%</span>
      </div>
      <Toolbar/>
      <InfiniteCanvas maskLayerRef={maskLayerRef}/>
      <PromptDock exportMaskBase64={() => maskLayerRef.current?.toDataURL()}/>
    </div>
  );
}
`);

console.log('\n⏳ Đang cài đặt thư viện cho client...');
execSync('npm install', { cwd: path.join(root, 'client'), stdio: 'inherit' });
console.log('\n🎉 HOÀN TẤT 100%! Mọi file đã sẵn sàng.');
