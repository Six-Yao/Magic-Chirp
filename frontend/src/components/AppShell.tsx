import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  ClipboardList,
  Filter,
  Map,
  Search,
  Settings,
  Sprout,
} from 'lucide-react';
import { api } from '../api/client';
import BirdsView from '../pages/BirdsView';
import MapView from '../pages/MapView';
import ProfileView from '../pages/ProfileView';
import RecordsView from '../pages/RecordsView';
import '../pages/views.css';
import type { ActiveTab, AuthState, MapRecord, RecordDetail } from '../types/models';
import CreateRecordDrawer from './CreateRecordDrawer';
import LoginDrawer from './LoginDrawer';
import RecordDetailDrawer from './RecordDetailDrawer';
import SettingsDrawer from './SettingsDrawer';
import './AppShell.css';

const TOKEN_KEY = 'magic_chirp_token';

const tabMeta: Record<ActiveTab, { title: string; subtitle: string }> = {
  map: { title: '校园观鸟', subtitle: 'Magic-Chirp' },
  records: { title: '全校记录', subtitle: '公开观鸟手账' },
  birds: { title: '鸟种图鉴', subtitle: '校园鸟类整理中' },
  profile: { title: '我的小角落', subtitle: '观鸟窗台' },
};

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
  const [createOpen, setCreateOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState<RecordDetail | null>(null);
  const [detailStatus, setDetailStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [notice, setNotice] = useState<string | null>(null);

  const currentMeta = tabMeta[activeTab];
  const isLoggedIn = auth.status === 'authenticated' && Boolean(auth.user && auth.token);
  const recentMapRecords = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return [...records]
      .filter((record) => new Date(record.observed_at) >= cutoff)
      .sort((left, right) => +new Date(right.observed_at) - +new Date(left.observed_at));
  }, [records]);

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
      setNotice(error instanceof Error ? error.message : '记录详情加载失败');
      window.setTimeout(() => setNotice(null), 2200);
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
    setNotice('记录成功，新的小鸟点位已加入地图。');
    window.setTimeout(() => setNotice(null), 2400);
  }

  const content = useMemo(() => {
    if (activeTab === 'map') {
      return (
        <MapView
          records={recentMapRecords}
          status={recordsStatus}
          onRefresh={refreshMapRecords}
          onOpenRecord={openRecordDetail}
        />
      );
    }
    if (activeTab === 'records') {
      return <RecordsView records={records} status={recordsStatus} onOpenRecord={openRecordDetail} />;
    }
    if (activeTab === 'birds') {
      return <BirdsView records={records} />;
    }
    return (
      <ProfileView
        token={auth.token}
        user={auth.user}
        isLoggedIn={isLoggedIn}
        onLoginRequest={() => setLoginOpen(true)}
        onLogout={handleLogout}
        onOpenRecord={openRecordDetail}
      />
    );
  }, [activeTab, auth.token, auth.user, isLoggedIn, records, recordsStatus]);

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="brand-tile" aria-hidden="true">
          <span>啾</span>
        </div>
        <div className="title-block">
          <p>{currentMeta.subtitle}</p>
          <h1>{currentMeta.title}</h1>
        </div>
        <button
          className="header-icon-button"
          type="button"
          aria-label="打开设置"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings size={22} />
        </button>
      </header>

      <section className="search-strip" aria-label="搜索和筛选">
        <label className="pixel-input">
          <Search size={18} />
          <input placeholder="搜索鸟种、地点或用户" />
        </label>
        <button className="filter-chip" type="button">
          <Filter size={18} />
          <span>筛选</span>
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
