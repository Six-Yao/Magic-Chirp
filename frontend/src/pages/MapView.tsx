import { Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { PointerEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { MapRecord } from '../types/models';
import './views.css';

const CAMPUS_BOUNDS = {
  minLat: 32.045,
  maxLat: 32.13,
  minLng: 118.75,
  maxLng: 118.98,
};

const MIN_SCALE = 0.42;
const MAX_SCALE = 2.4;

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type PointerSnapshot = {
  x: number;
  y: number;
};

function toPercent(value: number, min: number, max: number) {
  return Math.min(92, Math.max(8, ((value - min) / (max - min)) * 100));
}

function markerPosition(record: MapRecord) {
  return {
    left: `${toPercent(record.longitude, CAMPUS_BOUNDS.minLng, CAMPUS_BOUNDS.maxLng)}%`,
    top: `${100 - toPercent(record.latitude, CAMPUS_BOUNDS.minLat, CAMPUS_BOUNDS.maxLat)}%`,
  };
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function MapView({
  records,
  status,
  onRefresh,
  onOpenRecord,
}: {
  records: MapRecord[];
  status: 'loading' | 'ready' | 'error';
  onRefresh: () => void;
  onOpenRecord: (recordId: number) => void;
}) {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [isInteracting, setIsInteracting] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, PointerSnapshot>());
  const lastPinchDistance = useRef<number | null>(null);

  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      const delta = event.deltaY > 0 ? -0.12 : 0.12;
      const mapRect = mapRef.current?.getBoundingClientRect();
      if (!mapRect) return;

      zoomAt(event.clientX - mapRect.left, event.clientY - mapRect.top, delta);
    }

    mapElement.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => mapElement.removeEventListener('wheel', handleNativeWheel);
  }, []);

  function resetMap() {
    setViewport({ x: 0, y: 0, scale: 1 });
  }

  function zoomBy(delta: number) {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    zoomAt(mapElement.clientWidth / 2, mapElement.clientHeight / 2, delta);
  }

  function zoomAt(focusX: number, focusY: number, delta: number) {
    setViewport((current) => ({
      ...zoomViewportAt(current, focusX, focusY, clampScale(current.scale + delta)),
    }));
  }

  function zoomViewportAt(current: Viewport, focusX: number, focusY: number, nextScale: number) {
    const worldElement = worldRef.current;
    const worldLeft = worldElement?.offsetLeft ?? 0;
    const worldTop = worldElement?.offsetTop ?? 0;
    const scaleRatio = nextScale / current.scale;
    const originX = focusX - worldLeft;
    const originY = focusY - worldTop;

    return {
      x: originX - (originX - current.x) * scaleRatio,
      y: originY - (originY - current.y) * scaleRatio,
      scale: nextScale,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    setIsInteracting(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;

    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const activePointers = Array.from(pointers.current.values());

    if (activePointers.length === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      setViewport((current) => ({ ...current, x: current.x + dx, y: current.y + dy }));
      return;
    }

    if (activePointers.length >= 2) {
      const [first, second] = activePointers;
      const distance = Math.hypot(first.x - second.x, first.y - second.y);

      if (lastPinchDistance.current) {
        const mapRect = mapRef.current?.getBoundingClientRect();
        const focusX = (first.x + second.x) / 2 - (mapRect?.left ?? 0);
        const focusY = (first.y + second.y) / 2 - (mapRect?.top ?? 0);
        const nextScaleRatio = distance / lastPinchDistance.current;

        setViewport((current) =>
          zoomViewportAt(current, focusX, focusY, clampScale(current.scale * nextScaleRatio)),
        );
      }

      lastPinchDistance.current = distance;
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      lastPinchDistance.current = null;
    }
    if (pointers.current.size === 0) {
      setIsInteracting(false);
    }
  }

  return (
    <section className="map-view">
      <div
        ref={mapRef}
        className="pixel-campus-map"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={worldRef}
          className={`map-world${isInteracting ? ' is-interacting' : ''}`}
          style={{
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
          }}
        >
          <div className="lake">镜湖</div>
          <div className="path path-a" />
          <div className="path path-b" />
          <div className="path path-c" />
          <Building className="clock-tower" label="钟楼" />
          <Building className="library" label="图书馆" />
          <Building className="science" label="理学院" />
          <Building className="student-center" label="学生中心" />
          <div className="field-label lawn">大草坪</div>
          <div className="track">运动场</div>

          {records.map((record) => (
            <button
              className="bird-marker"
              key={record.id}
              style={
                {
                  ...markerPosition(record),
                  '--marker-scale': `${1 / viewport.scale}`,
                } as CSSProperties
              }
              type="button"
              onClick={() => onOpenRecord(record.id)}
            >
              <span>{record.bird_name.slice(0, 1)}</span>
              <small>{record.bird_name}</small>
            </button>
          ))}
        </div>

        <div
          className="map-control-stack"
          aria-label="地图控制"
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button type="button" onClick={() => zoomBy(0.18)} aria-label="放大地图">
            <Plus size={18} />
          </button>
          <button type="button" onClick={() => zoomBy(-0.18)} aria-label="缩小地图">
            <Minus size={18} />
          </button>
          <button type="button" onClick={resetMap} aria-label="地图回正">
            <RotateCcw size={18} />
          </button>
        </div>

        {status === 'loading' && <div className="map-status">正在加载小鸟点位...</div>}
        {status === 'ready' && records.length === 0 && (
          <div className="map-status">最近一周还没有公开点位</div>
        )}
        {status === 'error' && (
          <button className="map-status action" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            重新加载
          </button>
        )}
      </div>
    </section>
  );
}

function Building({ className, label }: { className: string; label: string }) {
  return (
    <div className={`campus-building ${className}`}>
      <i />
      <span>{label}</span>
    </div>
  );
}

export default MapView;
