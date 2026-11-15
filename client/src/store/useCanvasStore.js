import { create } from 'zustand';

// Tự động đánh nhãn @Ảnh 1, @Ảnh 2, @Video 1 cho các Node trên bàn vẽ vô cực
const assignNodeTags = (items) => {
  let imgCount = 0;
  let vidCount = 0;
  return items.map((item) => {
    if (item.type === 'video') {
      vidCount += 1;
      return { ...item, tag: `@Video${vidCount}` };
    }
    imgCount += 1;
    return { ...item, tag: `@Ảnh${imgCount}` };
  });
};

const initialNodes = assignNodeTags([
  {
    id: 'sample-1',
    type: 'image',
    name: 'Mẫu / Bối cảnh',
    url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80',
    x: 220,
    y: 120,
    width: 260,
    height: 340,
    brightness: 0,
    shadowBlur: 15,
    shadowOpacity: 0.5
  },
  {
    id: 'sample-2',
    type: 'image',
    name: 'Sản phẩm / Trang phục',
    url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80',
    x: 520,
    y: 120,
    width: 260,
    height: 340,
    brightness: 0,
    shadowBlur: 15,
    shadowOpacity: 0.5
  }
]);

export const useCanvasStore = create((set) => ({
  tool: 'select', // 'select' | 'pan' | 'brush' | 'motion'
  brushSize: 35,
  motionType: 'cinematic_zoom', // 'cinematic_zoom' | 'floating_3d' | 'pan_showcase' | 'pulse_glow'
  videoGenMode: 'reference', // 'reference' (@参考) | 'frames' (首尾帧)
  videoModel: 'seedance-2.0-mini', // 'seedance-2.0-mini' | 'seedance-2.0' | 'seedance-v1-lite' | 'seedance-v1-pro'
  videoResolution: '720p', // '720p' | '1080p'
  videoAspectRatio: '9:16', // '9:16' | '16:9' | '1:1'
  videoDuration: '5', // '4' | '5' | '10'
  refImageIds: ['sample-1', 'sample-2'],
  refVideoId: null,
  startFrameId: 'sample-1',
  endFrameId: 'sample-2',
  zoom: 1,
  stagePos: { x: 0, y: 0 },
  images: initialNodes,
  selectedId: 'sample-2',
  maskLines: [],
  motionLines: [],
  isLoading: false,

  setTool: (tool) => set({ tool }),
  setBrushSize: (brushSize) => set({ brushSize }),
  setMotionType: (motionType) => set({ motionType }),
  setVideoGenMode: (videoGenMode) => set({ videoGenMode }),
  setVideoModel: (videoModel) => set({ videoModel }),
  setVideoResolution: (videoResolution) => set({ videoResolution }),
  setVideoAspectRatio: (videoAspectRatio) => set({ videoAspectRatio }),
  setVideoDuration: (videoDuration) => set({ videoDuration }),
  setRefImageIds: (refImageIds) => set({ refImageIds }),
  toggleRefImageId: (id) =>
    set((s) => {
      const exists = s.refImageIds.includes(id);
      if (exists) {
        return { refImageIds: s.refImageIds.filter((x) => x !== id) };
      }
      return { refImageIds: [...s.refImageIds, id].slice(-4) };
    }),
  setRefVideoId: (refVideoId) => set({ refVideoId }),
  setStartFrameId: (startFrameId) => set({ startFrameId }),
  setEndFrameId: (endFrameId) => set({ endFrameId }),
  setZoom: (zoom) => set({ zoom }),
  setStagePos: (stagePos) => set({ stagePos }),
  setSelectedId: (selectedId) => set({ selectedId }),
  setIsLoading: (isLoading) => set({ isLoading }),

  addImage: (newImg) =>
    set((s) => {
      const updated = assignNodeTags([
        ...s.images,
        {
          type: 'image',
          name: (newImg.type === 'video' ? '🎬 Video AI ' : 'Layer ') + (s.images.length + 1),
          brightness: 0,
          shadowBlur: 15,
          shadowOpacity: 0.5,
          isPlaying: true,
          sourceNodeIds: [],
          ...newImg
        }
      ]);
      const added = updated[updated.length - 1];
      const nextRefImgs =
        added.type !== 'video' && s.refImageIds.length < 3
          ? [...s.refImageIds, added.id]
          : s.refImageIds;
      const nextRefVid = added.type === 'video' && !s.refVideoId ? added.id : s.refVideoId;

      return {
        images: updated,
        selectedId: added.id,
        refImageIds: nextRefImgs,
        refVideoId: nextRefVid
      };
    }),

  updateImage: (id, attrs) =>
    set((s) => ({
      images: s.images.map((i) => (i.id === id ? { ...i, ...attrs } : i))
    })),

  deleteSelected: () =>
    set((s) => {
      const filtered = assignNodeTags(s.images.filter((i) => i.id !== s.selectedId));
      return {
        images: filtered,
        selectedId: null,
        refImageIds: s.refImageIds.filter((id) => id !== s.selectedId),
        refVideoId: s.refVideoId === s.selectedId ? null : s.refVideoId
      };
    }),

  bringForward: () =>
    set((s) => {
      const idx = s.images.findIndex((i) => i.id === s.selectedId);
      if (idx === -1 || idx === s.images.length - 1) return s;
      const arr = [...s.images];
      const [item] = arr.splice(idx, 1);
      arr.splice(idx + 1, 0, item);
      return { images: assignNodeTags(arr) };
    }),

  sendBackward: () =>
    set((s) => {
      const idx = s.images.findIndex((i) => i.id === s.selectedId);
      if (idx <= 0) return s;
      const arr = [...s.images];
      const [item] = arr.splice(idx, 1);
      arr.splice(idx - 1, 0, item);
      return { images: assignNodeTags(arr) };
    }),

  addMaskLine: (line) => set((s) => ({ maskLines: [...s.maskLines, line] })),
  updateLastMaskLine: (points) =>
    set((s) => {
      const u = [...s.maskLines];
      if (u.length) u[u.length - 1].points = points;
      return { maskLines: u };
    }),
  clearMasks: () => set({ maskLines: [], motionLines: [] }),

  addMotionLine: (line) => set((s) => ({ motionLines: [...s.motionLines, line] })),
  updateLastMotionLine: (points) =>
    set((s) => {
      const u = [...s.motionLines];
      if (u.length) u[u.length - 1].points = points;
      return { motionLines: u };
    }),
  clearMotionLines: () => set({ motionLines: [] })
}));
