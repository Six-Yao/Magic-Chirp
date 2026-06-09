import { Minus, Plus, RefreshCw, RotateCcw } from 'lucide-react';
import type { CSSProperties, PointerEvent } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import campusMapUrl from '../assets/campus-map.webp';
import type { BirdPointLocation, MapRecord } from '../types/models';
import { getPixelBirdAsset } from '../utils/birdAssets';
import './views.css';

const CAMPUS_BOUNDS = {
  minLat: 32.045259133136796,
  maxLat: 32.06312309376441,
  minLng: 118.7737948486734,
  maxLng: 118.78447365466737,
};

const MIN_SCALE = 0.42;
const DEFAULT_SCALE = 1.6;
const RESET_SCALE = 2.4;
const MAX_SCALE = 8;
const MAP_ASPECT_RATIO = 4096 / 8192;
const MAP_OVERSCROLL_PX = 96;
const MAP_OVERSCROLL_RESISTANCE = 0.36;
const MAP_SCALE_OVERSCROLL = 0.18;
const WHEEL_ZOOM_FACTOR = 1.11;
const BUTTON_ZOOM_FACTOR = 1.18;
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

type MapSelectionStart = PointerSnapshot & {
  pointerId: number;
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
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function markerPosition(record: MapRecord) {
  return {
    left: toPercent(record.longitude, CAMPUS_BOUNDS.minLng, CAMPUS_BOUNDS.maxLng),
    top: 100 - toPercent(record.latitude, CAMPUS_BOUNDS.minLat, CAMPUS_BOUNDS.maxLat),
  };
}

function locationPosition(location: Pick<BirdPointLocation, 'latitude' | 'longitude'>) {
  return {
    left: toPercent(location.longitude, CAMPUS_BOUNDS.minLng, CAMPUS_BOUNDS.maxLng),
    top: 100 - toPercent(location.latitude, CAMPUS_BOUNDS.minLat, CAMPUS_BOUNDS.maxLat),
  };
}

function percentToLocation(left: number, top: number): BirdPointLocation {
  return {
    latitude: CAMPUS_BOUNDS.minLat + ((100 - top) / 100) * (CAMPUS_BOUNDS.maxLat - CAMPUS_BOUNDS.minLat),
    longitude: CAMPUS_BOUNDS.minLng + (left / 100) * (CAMPUS_BOUNDS.maxLng - CAMPUS_BOUNDS.minLng),
    locationName: '地图点选位置',
    source: 'map',
  };
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

function createClusters(records: MapRecord[], scale: number) {
  const clusters: RecordCluster[] = [];
  const clusterDistance = CLUSTER_DISTANCE / scale;

  records.forEach((record) => {
    const positioned: PositionedRecord = { record, ...markerPosition(record) };
    const cluster = clusters.find((item) => Math.hypot(item.left - positioned.left, item.top - positioned.top) <= clusterDistance);

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
  pointPickMode,
  selectedLocation,
  currentLocation,
  onRefresh,
  onOpenRecord,
  onPickLocation,
  onStatusMessage,
}: {
  records: MapRecord[];
  status: 'loading' | 'ready' | 'error';
  pointPickMode: boolean;
  selectedLocation: BirdPointLocation | null;
  currentLocation: BirdPointLocation | null;
  onRefresh: () => void;
  onOpenRecord: (recordId: number) => void;
  onPickLocation: (location: BirdPointLocation) => void;
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
  const selectionStart = useRef<MapSelectionStart | null>(null);
  const lastPinchDistance = useRef<number | null>(null);
  const clusterExitTimer = useRef<number | null>(null);
  const wheelSettleTimer = useRef<number | null>(null);
  const clusters = useMemo(() => createClusters(records, viewport.scale), [records, viewport.scale]);
  const selectedMarkerPosition = selectedLocation ? locationPosition(selectedLocation) : null;
  const activeCluster = clusters.find((cluster) => cluster.id === activeClusterId && cluster.records.length > 1);
  const closingCluster = clusters.find((cluster) => cluster.id === closingClusterId && cluster.records.length > 1);
  const renderedExpandedCluster = activeCluster ?? closingCluster;

  useLayoutEffect(() => {
    setViewport(centeredViewport(DEFAULT_SCALE));
  }, []);

  useEffect(() => {
    function handleResize() {
      setViewport((current) => clampViewport(current));
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    function handleNativeWheel(event: WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      const factor = event.deltaY > 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR;
      const mapRect = mapRef.current?.getBoundingClientRect();
      if (!mapRect) return;

      zoomAt(event.clientX - mapRect.left, event.clientY - mapRect.top, factor);
      if (wheelSettleTimer.current) {
        window.clearTimeout(wheelSettleTimer.current);
      }
      wheelSettleTimer.current = window.setTimeout(() => {
        setViewport((current) => clampViewport(current));
        wheelSettleTimer.current = null;
      }, 140);
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
      if (wheelSettleTimer.current) {
        window.clearTimeout(wheelSettleTimer.current);
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
    if (currentLocation) {
      setViewport(viewportForLocation(currentLocation, RESET_SCALE));
      return;
    }

    onStatusMessage('当前位置还在获取中，已回到地图中心');
    setViewport(centeredViewport(RESET_SCALE));
  }

  function mapMetrics() {
    const mapElement = mapRef.current;
    const worldElement = worldRef.current;
    if (!mapElement || !worldElement) return null;

    return {
      mapWidth: mapElement.clientWidth,
      mapHeight: mapElement.clientHeight,
      worldLeft: worldElement.offsetLeft,
      worldTop: worldElement.offsetTop,
      worldWidth: worldElement.offsetWidth,
      worldHeight: worldElement.offsetHeight,
    };
  }

  function minimumCoverScale() {
    const metrics = mapMetrics();
    if (!metrics) return MIN_SCALE;

    return Math.max(
      MIN_SCALE,
      metrics.mapWidth / metrics.worldWidth,
      metrics.mapHeight / metrics.worldHeight,
    );
  }

  function clampViewport(viewportValue: Viewport): Viewport {
    return boundViewport(viewportValue, 0);
  }

  function elasticViewport(viewportValue: Viewport): Viewport {
    return boundViewport(viewportValue, MAP_OVERSCROLL_PX);
  }

  function boundViewport(viewportValue: Viewport, overscroll: number): Viewport {
    const metrics = mapMetrics();
    if (!metrics) return viewportValue;

    const minimumScale = minimumCoverScale();
    const scale = Math.min(MAX_SCALE + MAP_SCALE_OVERSCROLL, Math.max(minimumScale - MAP_SCALE_OVERSCROLL, viewportValue.scale));
    const scaledWidth = metrics.worldWidth * scale;
    const scaledHeight = metrics.worldHeight * scale;
    const minX = Math.min(metrics.mapWidth - metrics.worldLeft - scaledWidth, -metrics.worldLeft);
    const maxX = Math.max(metrics.mapWidth - metrics.worldLeft - scaledWidth, -metrics.worldLeft);
    const minY = Math.min(metrics.mapHeight - metrics.worldTop - scaledHeight, -metrics.worldTop);
    const maxY = Math.max(metrics.mapHeight - metrics.worldTop - scaledHeight, -metrics.worldTop);

    return {
      x: Math.min(maxX + overscroll, Math.max(minX - overscroll, viewportValue.x)),
      y: Math.min(maxY + overscroll, Math.max(minY - overscroll, viewportValue.y)),
      scale,
    };
  }

  function applyRubberBand(value: number, min: number, max: number) {
    if (value < min) {
      return min + (value - min) * MAP_OVERSCROLL_RESISTANCE;
    }
    if (value > max) {
      return max + (value - max) * MAP_OVERSCROLL_RESISTANCE;
    }
    return value;
  }

  function rubberBandViewport(viewportValue: Viewport): Viewport {
    const metrics = mapMetrics();
    if (!metrics) return viewportValue;

    const scale = Math.min(MAX_SCALE, Math.max(minimumCoverScale(), viewportValue.scale));
    const scaledWidth = metrics.worldWidth * scale;
    const scaledHeight = metrics.worldHeight * scale;
    const minX = metrics.mapWidth - metrics.worldLeft - scaledWidth;
    const maxX = -metrics.worldLeft;
    const minY = metrics.mapHeight - metrics.worldTop - scaledHeight;
    const maxY = -metrics.worldTop;

    return elasticViewport({
      x: applyRubberBand(viewportValue.x, minX, maxX),
      y: applyRubberBand(viewportValue.y, minY, maxY),
      scale,
    });
  }

  function centeredViewport(scale: number): Viewport {
    const metrics = mapMetrics();
    if (!metrics) {
      return { x: 0, y: 0, scale: Math.max(scale, MIN_SCALE) };
    }

    const nextScale = Math.max(scale, minimumCoverScale());

    return clampViewport({
      x: metrics.mapWidth / 2 - metrics.worldLeft - (metrics.worldWidth * nextScale) / 2,
      y: metrics.mapHeight / 2 - metrics.worldTop - (metrics.worldHeight * nextScale) / 2,
      scale: nextScale,
    });
  }

  function viewportForLocation(location: Pick<BirdPointLocation, 'latitude' | 'longitude'>, scale: number): Viewport {
    const metrics = mapMetrics();
    if (!metrics) {
      return { x: 0, y: 0, scale: Math.max(scale, MIN_SCALE) };
    }

    const position = locationPosition(location);
    const nextScale = Math.max(scale, minimumCoverScale());
    const localX = (position.left / 100) * metrics.worldWidth;
    const localY = (position.top / 100) * metrics.worldHeight;

    return clampViewport({
      x: metrics.mapWidth / 2 - metrics.worldLeft - localX * nextScale,
      y: metrics.mapHeight / 2 - metrics.worldTop - localY * nextScale,
      scale: nextScale,
    });
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

  function zoomBy(factor: number) {
    const mapElement = mapRef.current;
    if (!mapElement) return;

    zoomAt(mapElement.clientWidth / 2, mapElement.clientHeight / 2, factor);
  }

  function zoomAt(focusX: number, focusY: number, factor: number) {
    setViewport((current) =>
      zoomViewportAt(current, focusX, focusY, elasticScale(current.scale * factor)),
    );
  }

  function elasticScale(scale: number) {
    const minScale = minimumCoverScale();
    if (scale < minScale) {
      return Math.max(minScale - MAP_SCALE_OVERSCROLL, minScale + (scale - minScale) * MAP_OVERSCROLL_RESISTANCE);
    }
    if (scale > MAX_SCALE) {
      return Math.min(MAX_SCALE + MAP_SCALE_OVERSCROLL, MAX_SCALE + (scale - MAX_SCALE) * MAP_OVERSCROLL_RESISTANCE);
    }
    return scale;
  }

  function zoomViewportAt(current: Viewport, focusX: number, focusY: number, nextScale: number) {
    const metrics = mapMetrics();
    if (!metrics) return { ...current, scale: nextScale };

    const boundedScale = nextScale;
    const mapLocalX = (focusX - metrics.worldLeft - current.x) / current.scale;
    const mapLocalY = (focusY - metrics.worldTop - current.y) / current.scale;

    return elasticViewport({
      x: focusX - metrics.worldLeft - mapLocalX * boundedScale,
      y: focusY - metrics.worldTop - mapLocalY * boundedScale,
      scale: boundedScale,
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    selectionStart.current = pointPickMode ? { pointerId: event.pointerId, x: event.clientX, y: event.clientY } : null;
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
      setViewport((current) => rubberBandViewport({ ...current, x: current.x + dx, y: current.y + dy }));
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
          zoomViewportAt(current, focusX, focusY, elasticScale(current.scale * nextScaleRatio)),
        );
      }

      lastPinchDistance.current = distance;
    }
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    const start = selectionStart.current;
    if (pointPickMode && start?.pointerId === event.pointerId) {
      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (movement <= 8) {
        pickLocationAt(event.clientX, event.clientY);
      }
    }
    selectionStart.current = null;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) {
      lastPinchDistance.current = null;
    }
    if (pointers.current.size === 0) {
      setIsInteracting(false);
      setViewport((current) => clampViewport(current));
    }
  }

  function pickLocationAt(clientX: number, clientY: number) {
    const metrics = mapMetrics();
    const mapRect = mapRef.current?.getBoundingClientRect();
    if (!metrics || !mapRect) return;

    const localX = clientX - mapRect.left;
    const localY = clientY - mapRect.top;
    const mapX = (localX - metrics.worldLeft - viewport.x) / viewport.scale;
    const mapY = (localY - metrics.worldTop - viewport.y) / viewport.scale;
    const left = Math.min(100, Math.max(0, (mapX / metrics.worldWidth) * 100));
    const top = Math.min(100, Math.max(0, (mapY / metrics.worldHeight) * 100));

    onPickLocation(percentToLocation(left, top));
  }

  return (
    <section className="map-view">
      <div
        ref={mapRef}
        className={`pixel-campus-map${pointPickMode ? ' picking-location' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          ref={worldRef}
          className={`map-world${isInteracting ? ' is-interacting' : ''}`}
          style={
            {
              '--map-aspect-ratio': MAP_ASPECT_RATIO,
              transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            } as CSSProperties
          }
        >
          <img className="campus-map-image" src={campusMapUrl} alt="" draggable={false} />

          {selectedMarkerPosition && (
            <div
              className="selected-location-marker"
              style={
                {
                  left: `${selectedMarkerPosition.left}%`,
                  top: `${selectedMarkerPosition.top}%`,
                  '--marker-scale': `${1 / viewport.scale}`,
                } as CSSProperties
              }
            />
          )}

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
          <button type="button" onClick={() => zoomBy(BUTTON_ZOOM_FACTOR)} aria-label="放大地图">
            <Plus size={18} />
          </button>
          <button type="button" onClick={() => zoomBy(1 / BUTTON_ZOOM_FACTOR)} aria-label="缩小地图">
            <Minus size={18} />
          </button>
          <button type="button" onClick={resetMap} aria-label="地图回正">
            <RotateCcw size={18} />
          </button>
        </div>

        {pointPickMode && (
          <div className="map-pick-hint" onPointerDown={(event) => event.stopPropagation()}>
            点击地图确定鸟点位置
          </div>
        )}

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
