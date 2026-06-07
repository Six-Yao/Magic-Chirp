import { Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import type { CSSProperties, PointerEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import campusMapUrl from '../assets/campus-map.png';
import type { MapRecord } from '../types/models';
import { getPixelBirdAsset } from '../utils/birdAssets';
import './views.css';

const CAMPUS_BOUNDS = {
  minLat: 32.045,
  maxLat: 32.13,
  minLng: 118.75,
  maxLng: 118.98,
};

const MIN_SCALE = 0.42;
const DEFAULT_SCALE = 1.6;
const MAX_SCALE = 8;
const CLUSTER_DISTANCE = 4.8;
const FRESHNESS_STEP_HOURS = 3;
const FRESHNESS_STEPS = 8;
const CLUSTER_EXIT_MS = 280;
const ORBIT_SPREAD_MS = 520;
const ORBIT_START_PAUSE_MS = 180;
const INNER_ORBIT_MS = 34_000;
const OUTER_ORBIT_MS = 46_000;

type Viewport = {
  x: number;
  y: number;
  scale: number;
};

type PointerSnapshot = {
  x: number;
  y: number;
};

type PositionedRecord = {
  record: MapRecord;
  left: number;
  top: number;
};

type RecordCluster = {
  id: string;
  left: number;
  top: number;
  records: MapRecord[];
};

function toPercent(value: number, min: number, max: number) {
  return Math.min(92, Math.max(8, ((value - min) / (max - min)) * 100));
}

function markerPosition(record: MapRecord) {
  return {
    left: toPercent(record.longitude, CAMPUS_BOUNDS.minLng, CAMPUS_BOUNDS.maxLng),
    top: 100 - toPercent(record.latitude, CAMPUS_BOUNDS.minLat, CAMPUS_BOUNDS.maxLat),
  };
}

function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function markerFreshnessColor(value: string) {
  const observedAt = new Date(value).getTime();
  const elapsedHours = Math.max(0, (Date.now() - observedAt) / 3_600_000);
  const freshnessStep = Math.max(0, FRESHNESS_STEPS - Math.floor(elapsedHours / FRESHNESS_STEP_HOURS));
  const freshness = freshnessStep / FRESHNESS_STEPS;
  const hue = 40 + freshness * 74;
  const saturation = 82 - freshness * 12;
  const lightness = 62 + freshness * 15;

  return `hsl(${Math.round(hue)} ${Math.round(saturation)}% ${Math.round(lightness)}%)`;
}

function latestRecord(records: MapRecord[]) {
  return records.reduce((latest, record) =>
    new Date(record.observed_at) > new Date(latest.observed_at) ? record : latest,
  );
}

function sortByNewest(records: MapRecord[]) {
  return [...records].sort((left, right) => +new Date(right.observed_at) - +new Date(left.observed_at));
}

function createClusters(records: MapRecord[]) {
  const clusters: RecordCluster[] = [];

  records.forEach((record) => {
    const positioned: PositionedRecord = { record, ...markerPosition(record) };
    const cluster = clusters.find((item) => Math.hypot(item.left - positioned.left, item.top - positioned.top) <= CLUSTER_DISTANCE);

    if (!cluster) {
      clusters.push({
        id: String(record.id),
        left: positioned.left,
        top: positioned.top,
        records: [record],
      });
      return;
    }

    cluster.records.push(record);
    cluster.left = (cluster.left * (cluster.records.length - 1) + positioned.left) / cluster.records.length;
    cluster.top = (cluster.top * (cluster.records.length - 1) + positioned.top) / cluster.records.length;
    cluster.id = cluster.records.map((item) => item.id).sort((left, right) => left - right).join('-');
  });

  return clusters;
}

function MapView({
  records,
  status,
  onRefresh,
  onOpenRecord,
  onStatusMessage,
}: {
  records: MapRecord[];
  status: 'loading' | 'ready' | 'error';
  onRefresh: () => void;
  onOpenRecord: (recordId: number) => void;
  onStatusMessage: (message: string | null) => void;
}) {
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: DEFAULT_SCALE });
  const [isInteracting, setIsInteracting] = useState(false);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [closingClusterId, setClosingClusterId] = useState<string | null>(null);
  const [clusterOpenedAt, setClusterOpenedAt] = useState<number | null>(null);
  const [clusterClosingAt, setClusterClosingAt] = useState<number | null>(null);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, PointerSnapshot>());
  const lastPinchDistance = useRef<number | null>(null);
  const clusterExitTimer = useRef<number | null>(null);
  const clusters = useMemo(() => createClusters(records), [records]);
  const activeCluster = clusters.find((cluster) => cluster.id === activeClusterId && cluster.records.length > 1);
  const closingCluster = clusters.find((cluster) => cluster.id === closingClusterId && cluster.records.length > 1);
  const renderedExpandedCluster = activeCluster ?? closingCluster;

  useLayoutEffect(() => {
    setViewport(centeredViewport(DEFAULT_SCALE));
  }, []);

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

  useEffect(() => {
    setActiveClusterId(null);
    setClosingClusterId(null);
    setClusterOpenedAt(null);
    setClusterClosingAt(null);
  }, [records]);

  useEffect(
    () => () => {
      if (clusterExitTimer.current) {
        window.clearTimeout(clusterExitTimer.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (status === 'loading') {
      onStatusMessage('正在加载鸟类点位...');
      return;
    }
    if (status === 'ready' && records.length === 0) {
      onStatusMessage('最近一周还没有公开点位');
      return;
    }
    if (status !== 'error') {
      onStatusMessage(null);
    }
  }, [onStatusMessage, records.length, status]);

  function resetMap() {
    setViewport(centeredViewport(DEFAULT_SCALE));
  }

  function centeredViewport(scale: number): Viewport {
    const mapElement = mapRef.current;
    const worldElement = worldRef.current;
    if (!mapElement || !worldElement) {
      return { x: 0, y: 0, scale };
    }

    return {
      x: mapElement.clientWidth / 2 - worldElement.offsetLeft - (worldElement.offsetWidth * scale) / 2,
      y: mapElement.clientHeight / 2 - worldElement.offsetTop - (worldElement.offsetHeight * scale) / 2,
      scale,
    };
  }

  function openCluster(clusterId: string) {
    if (clusterExitTimer.current) {
      window.clearTimeout(clusterExitTimer.current);
      clusterExitTimer.current = null;
    }
    setClosingClusterId(null);
    setClusterOpenedAt(Date.now());
    setClusterClosingAt(null);
    setActiveClusterId(clusterId);
  }

  function closeCluster() {
    if (!activeClusterId) return;

    if (clusterExitTimer.current) {
      window.clearTimeout(clusterExitTimer.current);
    }

    setClosingClusterId(activeClusterId);
    setClusterClosingAt(Date.now());
    setActiveClusterId(null);
    clusterExitTimer.current = window.setTimeout(() => {
      setClosingClusterId(null);
      setClusterOpenedAt(null);
      setClusterClosingAt(null);
      clusterExitTimer.current = null;
    }, CLUSTER_EXIT_MS);
  }

  function toggleCluster(clusterId: string) {
    if (activeClusterId === clusterId) {
      closeCluster();
      return;
    }
    openCluster(clusterId);
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
    closeCluster();
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
          style={{ transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})` }}
        >
          <img className="campus-map-image" src={campusMapUrl} alt="" draggable={false} />

          {clusters.map((cluster) => {
            const markerStyle = {
              left: `${cluster.left}%`,
              top: `${cluster.top}%`,
              '--marker-scale': `${1 / viewport.scale}`,
              '--marker-bg': markerFreshnessColor(latestRecord(cluster.records).observed_at),
            } as CSSProperties;

            if (cluster.records.length === 1) {
              const [record] = cluster.records;
              const pixelBirdUrl = getPixelBirdAsset(record.bird_name);
              return (
                <button
                  className="bird-marker"
                  key={cluster.id}
                  style={markerStyle}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => onOpenRecord(record.id)}
                >
                  <span className="bird-marker-avatar">
                    {pixelBirdUrl ? <img src={pixelBirdUrl} alt="" /> : record.bird_name.slice(0, 1)}
                  </span>
                </button>
              );
            }

            return (
              <button
                className={`bird-marker cluster-marker ${activeClusterId === cluster.id ? 'active' : ''}`}
                key={cluster.id}
                style={markerStyle}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => toggleCluster(cluster.id)}
              >
                <span className="bird-marker-avatar">{cluster.records.length}</span>
              </button>
            );
          })}

          {renderedExpandedCluster && (
            <div
              className={`expanded-cluster-birds ${closingClusterId === renderedExpandedCluster.id ? 'closing' : ''}`}
              style={
                {
                  left: `${renderedExpandedCluster.left}%`,
                  top: `${renderedExpandedCluster.top}%`,
                  '--marker-scale': `${1 / viewport.scale}`,
                } as CSSProperties
              }
              onPointerDown={(event) => event.stopPropagation()}
            >
              {sortByNewest(renderedExpandedCluster.records).map((record, index) => {
                const innerRingCount =
                  renderedExpandedCluster.records.length > 10
                    ? Math.min(10, Math.floor((renderedExpandedCluster.records.length - 1) / 2))
                    : renderedExpandedCluster.records.length;
                const outerRingCount = renderedExpandedCluster.records.length - innerRingCount;
                const pixelBirdUrl = getPixelBirdAsset(record.bird_name);
                const ring = index < innerRingCount ? 0 : 1;
                const ringIndex = ring === 0 ? index : index - innerRingCount;
                const ringCount = ring === 0 ? innerRingCount : outerRingCount;
                const orbitDirection = ring === 0 ? 1 : -1;
                const orbitDelay = ringIndex * 32 + ring * 90;
                const orbitDuration = ring === 0 ? INNER_ORBIT_MS : OUTER_ORBIT_MS;
                const baseAngle = ringCount > 0 ? (360 / ringCount) * ringIndex * orbitDirection : 0;
                const elapsedOrbitMs =
                  clusterOpenedAt && clusterClosingAt
                    ? Math.max(0, clusterClosingAt - clusterOpenedAt - orbitDelay - ORBIT_SPREAD_MS - ORBIT_START_PAUSE_MS)
                    : 0;
                const collapseAngle = baseAngle + orbitDirection * 360 * ((elapsedOrbitMs % orbitDuration) / orbitDuration);
                return (
                  <button
                    className={`expanded-bird-marker ${ring === 1 ? 'outer-ring' : ''}`}
                    key={record.id}
                    style={
                      {
                        '--bird-index': ringIndex,
                        '--bird-count': ringCount,
                        '--orbit-ring': ring,
                        '--marker-bg': markerFreshnessColor(record.observed_at),
                        '--collapse-angle': `${collapseAngle}deg`,
                      } as CSSProperties
                    }
                    type="button"
                    onClick={() => onOpenRecord(record.id)}
                  >
                    <span className="expanded-bird-avatar">
                      {pixelBirdUrl ? <img src={pixelBirdUrl} alt="" /> : record.bird_name.slice(0, 1)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="map-control-stack" aria-label="地图控制" onPointerDown={(event) => event.stopPropagation()}>
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

        {status === 'error' && (
          <button className="map-error-action" type="button" onClick={onRefresh}>
            <RefreshCw size={16} />
            重新加载
          </button>
        )}
      </div>
    </section>
  );
}

export default MapView;
