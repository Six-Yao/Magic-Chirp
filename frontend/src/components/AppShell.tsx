import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  ClipboardList,
  Filter,
  Map,
  Search,
  Sprout,
  X,
} from 'lucide-react';
import { api } from '../api/client';
import BirdsView from '../pages/BirdsView';
import MapView from '../pages/MapView';
import ProfileView from '../pages/ProfileView';
import RecordsView from '../pages/RecordsView';
import '../pages/views.css';
import type {
  ActiveTab,
  AuthState,
  BirdPointLocation,
  LocationCache,
  MapRecord,
  PublicRecordOptions,
  RecordDetail,
  RecordFilter,
  RecordQuery,
} from '../types/models';
import { wgs84ToGcj02 } from '../utils/coordinates';
import CreateRecordDrawer from './CreateRecordDrawer';
import FilterDrawer from './FilterDrawer';
import LoginDrawer from './LoginDrawer';
import RecordDetailDrawer from './RecordDetailDrawer';
import SettingsDrawer from './SettingsDrawer';
import './AppShell.css';

const TOKEN_KEY = 'magic_chirp_token';
const LOCATION_REFRESH_MS = 30_000;
const LOCATION_TIMEOUT_MS = 12_000;
const LOCATION_FALLBACK_TIMEOUT_MS = 8_000;

function matchesSearch(record: Pick<MapRecord, 'bird_name' | 'location_name' | 'author_nickname'>, query: string) {
  if (!query) return true;

  return [record.bird_name, record.location_name, record.author_nickname]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

function isInsideLocation(record: MapRecord, bounds?: [number, number, number, number]) {
  if (!bounds) return true;

  const [longitudeLeft, longitudeRight, latitudeLeft, latitudeRight] = bounds;
  const minLongitude = Math.min(longitudeLeft, longitudeRight);
  const maxLongitude = Math.max(longitudeLeft, longitudeRight);
  const minLatitude = Math.min(latitudeLeft, latitudeRight);
  const maxLatitude = Math.max(latitudeLeft, latitudeRight);

  return (
    record.longitude >= minLongitude &&
    record.longitude <= maxLongitude &&
    record.latitude >= minLatitude &&
    record.latitude <= maxLatitude
  );
}

function matchLocationName(
  location: Pick<BirdPointLocation, 'latitude' | 'longitude'>,
  locations: PublicRecordOptions['locations'],
) {
  return Object.entries(locations).find(([, bounds]) =>
    isInsideLocation(
      {
        id: 0,
        bird_name: '',
        latitude: location.latitude,
        longitude: location.longitude,
        observed_at: '',
        author_nickname: '',
      },
      bounds,
    ),
  )?.[0];
}

function mapFilterToQuery(filter: RecordFilter): RecordQuery {
  const query: RecordQuery = {};

  if (filter.birdName) {
    query.birdName = filter.birdName;
  }

  if (filter.dateRange === 'all') return query;

  const start = new Date();
  start.setDate(start.getDate() - (filter.dateRange === 'week' ? 7 : 30));
  query.startTime = start.toISOString().slice(0, 19);
  query.endTime = new Date().toISOString().slice(0, 19);
  return query;
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return '定位权限被拒绝，请在浏览器地址栏左侧允许位置权限。';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return '系统暂时拿不到定位，请确认系统定位服务已开启。';
  }
  if (error.code === error.TIMEOUT) {
    return '定位超时，室内或电脑端可能较慢，可以稍后重试或改用地图点选。';
  }
  return error.message || '定位失败，可以改用地图点选。';
}

function getBrowserPosition(options: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('map');
  const [auth, setAuth] = useState<AuthState>({
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    status: localStorage.getItem(TOKEN_KEY) ? 'checking' : 'guest',
  });
  const [records, setRecords] = useState<MapRecord[]>([]);
  const [recordsStatus, setRecordsStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loginOpen, setLoginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pointPickMode, setPointPickMode] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<BirdPointLocation | null>(null);
  const [detailRecord, setDetailRecord] = useState<RecordDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [deletingRecordId, setDeletingRecordId] = useState<number | null>(null);
  const [deletedRecordId, setDeletedRecordId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordFilter, setRecordFilter] = useState<RecordFilter>({ dateRange: 'all' });
  const [recordOptions, setRecordOptions] = useState<PublicRecordOptions>({ bird_names: [], locations: {} });
  const [locationCache, setLocationCache] = useState<LocationCache>({
    location: null,
    accuracy: null,
    updatedAt: null,
    status: 'idle',
  });

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const mapRecordQuery = useMemo(() => mapFilterToQuery(recordFilter), [recordFilter]);
  const isLoggedIn = auth.status === 'authenticated' && Boolean(auth.user && auth.token);
  const selectedLocationBounds = recordFilter.locationName ? recordOptions.locations[recordFilter.locationName] : undefined;
  const filteredRecords = useMemo(
    () => records.filter((record) => matchesSearch(record, normalizedSearch) && isInsideLocation(record, selectedLocationBounds)),
    [records, normalizedSearch, selectedLocationBounds],
  );
  const hasActiveFilter = recordFilter.dateRange !== 'all' || Boolean(recordFilter.birdName || recordFilter.locationName);

  const showNotice = useCallback((message: string | null) => {
    setNotice(message);
  }, []);

  const refreshCurrentLocation = useCallback(
    async (maximumAge = LOCATION_REFRESH_MS) => {
      if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
        setLocationCache((current) => ({ ...current, status: 'unsupported' }));
        throw new Error('浏览器定位要求 HTTPS 或 localhost，当前页面环境不能获取定位。');
      }
      if (!navigator.geolocation) {
        setLocationCache((current) => ({ ...current, status: 'unsupported' }));
        throw new Error('当前浏览器不支持定位');
      }

      try {
        let position: GeolocationPosition;
        try {
          position = await getBrowserPosition({ enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge });
        } catch (error) {
          const geolocationError = error as GeolocationPositionError;
          if (geolocationError.code !== geolocationError.TIMEOUT) {
            throw geolocationError;
          }
          position = await getBrowserPosition({
            enableHighAccuracy: false,
            timeout: LOCATION_FALLBACK_TIMEOUT_MS,
            maximumAge,
          });
        }

        const gcjLocation = wgs84ToGcj02(position.coords.longitude, position.coords.latitude);
        const matchedLocation = matchLocationName(gcjLocation, recordOptions.locations);
        const nextLocation: BirdPointLocation = {
          latitude: gcjLocation.latitude,
          longitude: gcjLocation.longitude,
          locationName: matchedLocation ?? '当前位置',
          source: 'gps',
        };
        setLocationCache({
          location: nextLocation,
          accuracy: position.coords.accuracy,
          updatedAt: Date.now(),
          status: 'ready',
        });
        return nextLocation;
      } catch (error) {
        setLocationCache((current) => ({ ...current, status: 'error' }));
        throw new Error(geolocationErrorMessage(error as GeolocationPositionError));
      }
    },
    [recordOptions.locations],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const recentMapRecords = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return [...filteredRecords]
      .filter((record) => new Date(record.observed_at) >= cutoff)
      .sort((left, right) => +new Date(right.observed_at) - +new Date(left.observed_at));
  }, [filteredRecords]);

  async function refreshMapRecords() {
    setRecordsStatus('loading');
    try {
      const items = await api.listMapRecords(mapRecordQuery);
      setRecords(items);
      setRecordsStatus('ready');
    } catch {
      setRecordsStatus('error');
    }
  }

  useEffect(() => {
    refreshMapRecords();
  }, [mapRecordQuery]);

  useEffect(() => {
    api
      .getRecordOptions()
      .then(setRecordOptions)
      .catch(() => setRecordOptions({ bird_names: [], locations: {} }));
  }, []);

  useEffect(() => {
    refreshCurrentLocation().catch(() => undefined);
    const timer = window.setInterval(() => {
      refreshCurrentLocation().catch(() => undefined);
    }, LOCATION_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refreshCurrentLocation]);

  useEffect(() => {
    if (!auth.token) {
      setAuth((current) => ({ ...current, user: null, status: 'guest' }));
      return;
    }

    api
      .getMe(auth.token)
      .then((user) => setAuth({ token: auth.token, user, status: 'authenticated' }))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setAuth({ token: null, user: null, status: 'guest' });
      });
  }, [auth.token]);

  async function openRecordDetail(recordId: number) {
    setDetailStatus('loading');
    try {
      const detail = await api.getRecordDetail(recordId, auth.token);
      setDetailRecord(detail);
      setDetailStatus('idle');
    } catch (error) {
      setDetailStatus('error');
      showNotice(error instanceof Error ? error.message : '记录详情加载失败');
    }
  }

  function requireLogin(action: () => void) {
    if (!isLoggedIn) {
      setLoginOpen(true);
      return;
    }
    action();
  }

  function handleCreateClick() {
    requireLogin(() => {
      setPointPickMode(false);
      setCreateOpen(true);
    });
  }

  function handlePickOnMap() {
    setCreateOpen(false);
    setDetailRecord(null);
    setPointPickMode(true);
    setActiveTab('map');
    showNotice('点击地图来放置这次观鸟的位置');
  }

  function handleLocationPicked(location: BirdPointLocation) {
    const matchedLocation = matchLocationName(location, recordOptions.locations);
    setPendingLocation(matchedLocation ? { ...location, locationName: matchedLocation } : location);
    setPointPickMode(false);
    setCreateOpen(true);
    showNotice('鸟点位置已选好，可以继续填写记录');
  }

  function handleCreateClose() {
    setCreateOpen(false);
    setPointPickMode(false);
    setPendingLocation(null);
  }

  function handleProfileClick() {
    if (!isLoggedIn) {
      setLoginOpen(true);
      return;
    }
    setActiveTab('profile');
  }

  function handleLoginSuccess(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
    setAuth({ token, user: null, status: 'checking' });
    setLoginOpen(false);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setAuth({ token: null, user: null, status: 'guest' });
    setActiveTab('map');
  }

  async function handleCreated(recordId: number) {
    setCreateOpen(false);
    setPointPickMode(false);
    setPendingLocation(null);
    await refreshMapRecords();
    await openRecordDetail(recordId);
    showNotice('记录成功，新的鸟类点位已加入地图');
  }

  async function handleDeleteRecord(recordId: number) {
    if (!auth.token) {
      setLoginOpen(true);
      return;
    }

    setDeletingRecordId(recordId);
    try {
      await api.deleteRecord(recordId, auth.token);
      setDetailRecord(null);
      setDeletedRecordId(recordId);
      await refreshMapRecords();
      showNotice('鸟点已删除');
    } catch (error) {
      showNotice(error instanceof Error ? error.message : '删除鸟点失败');
    } finally {
      setDeletingRecordId(null);
    }
  }

  const content = useMemo(() => {
    if (activeTab === 'map') {
      return (
        <MapView
          records={recentMapRecords}
          status={recordsStatus}
          pointPickMode={pointPickMode}
          selectedLocation={pendingLocation}
          currentLocation={locationCache.location}
          onRefresh={refreshMapRecords}
          onOpenRecord={openRecordDetail}
          onPickLocation={handleLocationPicked}
          onStatusMessage={showNotice}
        />
      );
    }
    if (activeTab === 'records') {
      return <RecordsView records={filteredRecords} status={recordsStatus} searchQuery={normalizedSearch} onOpenRecord={openRecordDetail} />;
    }
    if (activeTab === 'birds') {
      return <BirdsView records={filteredRecords} searchQuery={normalizedSearch} onOpenRecord={openRecordDetail} />;
    }
    return (
      <ProfileView
        token={auth.token}
        user={auth.user}
        isLoggedIn={isLoggedIn}
        searchQuery={normalizedSearch}
        onLoginRequest={() => setLoginOpen(true)}
        onLogout={handleLogout}
        onSettingsRequest={() => setSettingsOpen(true)}
        onProfileUpdated={(user) => setAuth((current) => ({ ...current, user }))}
        onOpenRecord={openRecordDetail}
        deletedRecordId={deletedRecordId}
      />
    );
  }, [
    activeTab,
    auth.token,
    auth.user,
    deletedRecordId,
    filteredRecords,
    isLoggedIn,
    normalizedSearch,
    pendingLocation,
    pointPickMode,
    recordsStatus,
    showNotice,
  ]);

  return (
    <div className="app-layout">
      <section className="search-strip" aria-label="搜索和筛选">
        <label className="pixel-input">
          <Search size={18} />
          <input
            value={searchQuery}
            placeholder="搜索鸟种、地点或用户"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" type="button" aria-label="清空搜索" onClick={() => setSearchQuery('')}>
              <X size={16} />
            </button>
          )}
        </label>
        <button className={`filter-chip ${hasActiveFilter ? 'active' : ''}`} type="button" onClick={() => setFilterOpen(true)}>
          <Filter size={18} />
          <span>{hasActiveFilter ? '已筛选' : '筛选'}</span>
        </button>
      </section>

      <main className="app-content">{content}</main>

      <button className="floating-create" type="button" aria-label="新建观鸟记录" onClick={handleCreateClick}>
        <Camera size={34} />
        <span>+</span>
      </button>

      <nav className="bottom-nav" aria-label="底部导航">
        <button
          className={`nav-action ${activeTab === 'map' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('map')}
        >
          <Map size={22} />
          <span>地图</span>
        </button>
        <button
          className={`nav-action ${activeTab === 'records' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('records')}
        >
          <ClipboardList size={22} />
          <span>记录</span>
        </button>
        <button
          className={`nav-action ${activeTab === 'birds' ? 'active' : ''}`}
          type="button"
          onClick={() => setActiveTab('birds')}
        >
          <BookOpen size={22} />
          <span>鸟种</span>
        </button>
        <button
          className={`nav-action ${activeTab === 'profile' ? 'active' : ''}`}
          type="button"
          onClick={handleProfileClick}
        >
          <Sprout size={22} />
          <span>我的</span>
        </button>
      </nav>

      <LoginDrawer
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      <SettingsDrawer
        open={settingsOpen}
        auth={auth}
        onClose={() => setSettingsOpen(false)}
        onLogin={() => {
          setSettingsOpen(false);
          setLoginOpen(true);
        }}
        onLogout={() => {
          handleLogout();
          setSettingsOpen(false);
        }}
      />
      <FilterDrawer
        open={filterOpen}
        value={recordFilter}
        options={recordOptions}
        onChange={setRecordFilter}
        onClose={() => setFilterOpen(false)}
      />
      <RecordDetailDrawer
        record={detailRecord}
        loading={detailStatus === 'loading'}
        canDelete={Boolean(auth.user && detailRecord && auth.user.id === detailRecord.author.id)}
        deleting={Boolean(detailRecord && deletingRecordId === detailRecord.id)}
        onClose={() => setDetailRecord(null)}
        onDelete={handleDeleteRecord}
      />
      <CreateRecordDrawer
        open={createOpen}
        token={auth.token}
        selectedLocation={pendingLocation}
        locations={recordOptions.locations}
        currentLocation={locationCache.location}
        onRequestCurrentLocation={() => refreshCurrentLocation(0)}
        onClose={handleCreateClose}
        onCreated={handleCreated}
        onPickOnMap={handlePickOnMap}
      />

      {notice && <div className="toast-message">{notice}</div>}
    </div>
  );
}

export default AppShell;
