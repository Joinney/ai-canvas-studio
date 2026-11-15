import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Arrow, Transformer, Group, Rect, Text, Circle } from 'react-konva';
import Konva from 'konva';
import { useCanvasStore } from '../store/useCanvasStore';

function NodeHeaderBadge({ imageProps, isRefActive }) {
  const tagText = `${imageProps.tag || '@Node'} • ${imageProps.name || 'Layer'}`;
  const isVideo = imageProps.type === 'video';

  return (
    <Group x={imageProps.x} y={imageProps.y - 28} listening={false}>
      <Rect
        width={Math.min(imageProps.width, 220)}
        height={22}
        fill={
          isVideo
            ? 'rgba(147, 51, 234, 0.9)'
            : isRefActive
            ? 'rgba(79, 70, 229, 0.9)'
            : 'rgba(24, 24, 27, 0.85)'
        }
        stroke={isVideo ? '#c084fc' : isRefActive ? '#818cf8' : '#3f3f46'}
        strokeWidth={1}
        cornerRadius={6}
      />
      <Text
        text={tagText}
        x={8}
        y={5}
        width={Math.min(imageProps.width, 220) - 16}
        fontSize={11}
        fontStyle="bold"
        fill="#ffffff"
        ellipsis={true}
        wrap="none"
      />
      {/* Cổng kết nối Node (Output Port bên phải & Input Port bên trái) */}
      <Circle
        x={imageProps.width}
        y={28 + imageProps.height / 2}
        radius={5}
        fill={isVideo ? '#c084fc' : '#6366f1'}
        stroke="#18181b"
        strokeWidth={2}
      />
      {isVideo && (
        <Circle
          x={0}
          y={28 + imageProps.height / 2}
          radius={5}
          fill="#ec4899"
          stroke="#18181b"
          strokeWidth={2}
        />
      )}
    </Group>
  );
}

function URLImage({ imageProps, isSelected, isRefActive, onSelect, onChange, draggable }) {
  const [img, setImg] = useState(null);
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    const i = new window.Image();
    i.crossOrigin = 'Anonymous';
    i.src = imageProps.url;
    i.onload = () => {
      setImg(i);
      if (shapeRef.current) {
        shapeRef.current.cache();
      }
    };
  }, [imageProps.url]);

  useEffect(() => {
    if (shapeRef.current && img) {
      shapeRef.current.cache();
      shapeRef.current.getLayer()?.batchDraw();
    }
  }, [imageProps.brightness, imageProps.width, imageProps.height, img]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const konvaBrightness = (imageProps.brightness || 0) / 100;

  return (
    <>
      <NodeHeaderBadge imageProps={imageProps} isRefActive={isRefActive} />
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
        shadowColor="black"
        shadowBlur={imageProps.shadowBlur ?? 15}
        shadowOpacity={imageProps.shadowOpacity ?? 0.5}
        shadowOffsetX={0}
        shadowOffsetY={12}
        filters={[Konva.Filters.Brighten]}
        brightness={konvaBrightness}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const n = shapeRef.current;
          const sx = n.scaleX();
          const sy = n.scaleY();
          n.scaleX(1);
          n.scaleY(1);
          onChange({
            x: n.x(),
            y: n.y(),
            width: Math.max(40, n.width() * sx),
            height: Math.max(40, n.height() * sy)
          });
        }}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          borderStroke="#6366f1"
          anchorStroke="#6366f1"
          anchorSize={9}
          borderDash={[4, 4]}
        />
      )}
    </>
  );
}

function URLVideo({ imageProps, isSelected, onSelect, onChange, draggable }) {
  const [videoElement, setVideoElement] = useState(null);
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    const vid = document.createElement('video');
    vid.src = imageProps.url;
    vid.crossOrigin = 'Anonymous';
    vid.loop = true;
    vid.muted = true;
    vid.playsInline = true;
    vid.autoplay = true;

    const handleLoaded = () => {
      setVideoElement(vid);
      vid.play().catch(() => {});
    };

    vid.addEventListener('loadeddata', handleLoaded);
    vid.load();

    return () => {
      vid.pause();
      vid.removeEventListener('loadeddata', handleLoaded);
      vid.src = '';
    };
  }, [imageProps.url]);

  useEffect(() => {
    if (!videoElement) return;
    if (imageProps.isPlaying === false) {
      videoElement.pause();
    } else {
      videoElement.play().catch(() => {});
    }
  }, [imageProps.isPlaying, videoElement]);

  useEffect(() => {
    if (!videoElement || !shapeRef.current) return;
    const layer = shapeRef.current.getLayer();
    if (!layer) return;

    const anim = new Konva.Animation(() => {}, layer);
    anim.start();
    return () => anim.stop();
  }, [videoElement]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <NodeHeaderBadge imageProps={imageProps} isRefActive={true} />
      <KonvaImage
        ref={shapeRef}
        image={videoElement}
        x={imageProps.x}
        y={imageProps.y}
        width={imageProps.width}
        height={imageProps.height}
        draggable={draggable}
        onClick={onSelect}
        onTap={onSelect}
        shadowColor="#a855f7"
        shadowBlur={imageProps.shadowBlur ?? 20}
        shadowOpacity={imageProps.shadowOpacity ?? 0.45}
        shadowOffsetX={0}
        shadowOffsetY={10}
        onDragEnd={(e) => onChange({ x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const n = shapeRef.current;
          const sx = n.scaleX();
          const sy = n.scaleY();
          n.scaleX(1);
          n.scaleY(1);
          onChange({
            x: n.x(),
            y: n.y(),
            width: Math.max(60, n.width() * sx),
            height: Math.max(60, n.height() * sy)
          });
        }}
      />
      <Group x={imageProps.x + 10} y={imageProps.y + 10} listening={false}>
        <Rect
          width={98}
          height={22}
          fill="rgba(147, 51, 234, 0.85)"
          cornerRadius={6}
        />
        <Text
          text={imageProps.isPlaying === false ? '⏸ TẠM DỪNG' : '🎬 SEEDANCE'}
          x={8}
          y={5}
          fontSize={11}
          fontStyle="bold"
          fill="#ffffff"
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          borderStroke="#a855f7"
          anchorStroke="#a855f7"
          anchorSize={9}
          borderDash={[4, 4]}
        />
      )}
    </>
  );
}

export default function InfiniteCanvas({ stageRef, maskLayerRef }) {
  const isDrawing = useRef(false);
  const {
    tool,
    brushSize,
    zoom,
    stagePos,
    setZoom,
    setStagePos,
    images,
    selectedId,
    setSelectedId,
    updateImage,
    maskLines,
    addMaskLine,
    updateLastMaskLine,
    motionLines,
    addMotionLine,
    updateLastMotionLine,
    refImageIds,
    refVideoId,
    videoGenMode,
    startFrameId,
    endFrameId
  } = useCanvasStore();

  const handleWheel = (e) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale
    };
    const newScale = Math.max(0.15, Math.min(e.evt.deltaY < 0 ? oldScale * 1.08 : oldScale / 1.08, 5));
    setZoom(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale
    });
  };

  const handleMouseDown = (e) => {
    if (tool === 'select' && e.target === e.target.getStage()) return setSelectedId(null);
    if (tool !== 'brush' && tool !== 'motion') return;

    isDrawing.current = true;
    const pos = e.target.getStage().getRelativePointerPosition();
    if (tool === 'brush') {
      addMaskLine({ points: [pos.x, pos.y], brushSize });
    } else if (tool === 'motion') {
      addMotionLine({ points: [pos.x, pos.y] });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;
    const pos = e.target.getStage().getRelativePointerPosition();

    if (tool === 'brush') {
      const last = maskLines[maskLines.length - 1];
      if (last) updateLastMaskLine(last.points.concat([pos.x, pos.y]));
    } else if (tool === 'motion') {
      const last = motionLines[motionLines.length - 1];
      if (last) updateLastMotionLine(last.points.concat([pos.x, pos.y]));
    }
  };

  // Tạo danh sách các đường dây liên kết Node (Node Workflow Wires) từ @Ảnh1, @Ảnh2 -> Video Thành Phẩm
  const nodeWires = [];
  images.forEach((targetNode) => {
    if (targetNode.sourceNodeIds && targetNode.sourceNodeIds.length > 0) {
      targetNode.sourceNodeIds.forEach((srcId) => {
        const srcNode = images.find((n) => n.id === srcId);
        if (srcNode) {
          const x1 = srcNode.x + srcNode.width;
          const y1 = srcNode.y + srcNode.height / 2;
          const x2 = targetNode.x;
          const y2 = targetNode.y + targetNode.height / 2;
          const cx1 = x1 + Math.max(60, Math.abs(x2 - x1) * 0.45);
          const cy1 = y1;
          const cx2 = x2 - Math.max(60, Math.abs(x2 - x1) * 0.45);
          const cy2 = y2;
          nodeWires.push({
            id: `${srcId}->${targetNode.id}`,
            points: [x1, y1, cx1, cy1, cx2, cy2, x2, y2]
          });
        }
      });
    }
  });

  return (
    <div
      className="w-screen h-screen"
      style={{
        backgroundImage: 'radial-gradient(#2e2e34 1.5px, transparent 1.5px)',
        backgroundSize: 24 * zoom + 'px ' + 24 * zoom + 'px',
        backgroundPosition: stagePos.x + 'px ' + stagePos.y + 'px',
        cursor: tool === 'pan' ? 'grab' : tool === 'brush' || tool === 'motion' ? 'crosshair' : 'default'
      }}
    >
      <Stage
        ref={stageRef}
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
        {/* Layer vẽ đường dây nối giữa các Node nguyên liệu (@Ảnh1, @Ảnh2) và Node Video Thành Phẩm */}
        <Layer listening={false}>
          {nodeWires.map((wire) => (
            <Line
              key={wire.id}
              points={wire.points}
              bezier={true}
              stroke="#a855f7"
              strokeWidth={3}
              dash={[8, 6]}
              shadowColor="#ec4899"
              shadowBlur={10}
              opacity={0.85}
            />
          ))}
        </Layer>

        <Layer>
          {images.map((item) => {
            const isRefActive =
              videoGenMode === 'reference'
                ? refImageIds.includes(item.id) || refVideoId === item.id
                : startFrameId === item.id || endFrameId === item.id;

            return item.type === 'video' ? (
              <URLVideo
                key={item.id}
                imageProps={item}
                isSelected={item.id === selectedId && tool === 'select'}
                draggable={tool === 'select'}
                onSelect={() => setSelectedId(item.id)}
                onChange={(a) => updateImage(item.id, a)}
              />
            ) : (
              <URLImage
                key={item.id}
                imageProps={item}
                isSelected={item.id === selectedId && tool === 'select'}
                isRefActive={isRefActive}
                draggable={tool === 'select'}
                onSelect={() => setSelectedId(item.id)}
                onChange={(a) => updateImage(item.id, a)}
              />
            );
          })}
        </Layer>

        {/* Layer vẽ Mask Inpaint */}
        <Layer ref={maskLayerRef}>
          {maskLines.map((l, i) => (
            <Line
              key={i}
              points={l.points}
              stroke="rgba(99, 102, 241, 0.6)"
              strokeWidth={l.brushSize}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </Layer>

        {/* Layer vẽ Quỹ Đạo Chuyển Động Video AI (Motion Brush) */}
        <Layer listening={false}>
          {motionLines.map((l, i) => (
            <Arrow
              key={i}
              points={l.points}
              stroke="#c084fc"
              fill="#c084fc"
              strokeWidth={5}
              pointerLength={14}
              pointerWidth={14}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
              shadowColor="#9333ea"
              shadowBlur={12}
              dash={[10, 6]}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
