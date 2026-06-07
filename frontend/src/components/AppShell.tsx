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
import type { ActiveTab, AuthState, MapRecord, RecordDetail, RecordFilter } from '../types/models';
import CreateRecordDrawer from './CreateRecordDrawer';
import FilterDrawer from './FilterDrawer';
import LoginDrawer from './LoginDrawer';
import RecordDetailDrawer from './RecordDetailDrawer';
import SettingsDrawer from './SettingsDrawer';
import './AppShell.css';

const TOKEN_KEY = 'magic_chirp_token';

function matchesSearch(record: Pick<MapRecord, 'bird_name' | 'location_name' | 'author_nickname'>, query: string) {
  if (!query) return true;

  return [record.bird_name, record.location_name, record.author_nickname]
    .filter(Boolean)
    .some((value) => value!.toLowerCase().includes(query));
}

function matchesFilter(record: MapRecord, filter: RecordFilter) {
  if (filter.dateRange === 'all') return true;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (filter.dateRange === 'week' ? 7 : 30));
  return new Date(record.observed_at) >= cutoff;
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
  const [detailRecord, setDetailRecord] = useState<RecordDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [recordFilter, setRecordFilter] = useState<RecordFilter>({ dateRange: 'all' });

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const isLoggedIn = auth.status === 'authenticated' && Boolean(auth.user && auth.token);
  const filteredRecords = useMemo(
    () => records.filter((record) => matchesSearch(record, normalizedSearch) && matchesFilter(record, recordFilter)),
    [records, normalizedSearch, recordFilter],
  );
  const hasActiveFilter = recordFilter.dateRange !== 'all';

  const showNotice = useCallback((message: string | null) => {
    setNotice(message);
  }, []);

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
      const items = await api.listMapRecords();
      setRecords(items);
      setRecordsStatus('ready');
    } catch {
      setRecordsStatus('error');
    }
  }

  useEffect(() => {
    refreshMapRecords();
  }, []);

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
    requireLogin(() => setCreateOpen(true));
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
    await refreshMapRecords();
    await openRecordDetail(recordId);
    showNotice('记录成功，新的鸟类点位已加入地图');
  }

  const content = useMemo(() => {
    if (activeTab === 'map') {
      return (
        <MapView
          records={recentMapRecords}
          status={recordsStatus}
          onRefresh={refreshMapRecords}
          onOpenRecord={openRecordDetail}
          onStatusMessage={showNotice}
        />
      );
    }
    if (activeTab === 'records') {
      return <RecordsView records={filteredRecords} status={recordsStatus} searchQuery={normalizedSearch} onOpenRecord={openRecordDetail} />;
    }
    if (activeTab === 'birds') {
      return <BirdsView records={filteredRecords} searchQuery={normalizedSearch} />;
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
      />
    );
  }, [activeTab, auth.token, auth.user, filteredRecords, isLoggedIn, normalizedSearch, recordsStatus, showNotice]);

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
        onChange={setRecordFilter}
        onClose={() => setFilterOpen(false)}
      />
      <RecordDetailDrawer
        record={detailRecord}
        loading={detailStatus === 'loading'}
        onClose={() => setDetailRecord(null)}
      />
      <CreateRecordDrawer
        open={createOpen}
        token={auth.token}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />

      {notice && <div className="toast-message">{notice}</div>}
    </div>
  );
}

export default AppShell;
