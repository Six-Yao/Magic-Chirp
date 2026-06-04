import { LogOut, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api, resolveAssetUrl } from '../api/client';
import type { MyRecord, User } from '../types/models';
import './views.css';

function ProfileView({
  token,
  user,
  isLoggedIn,
  onLoginRequest,
  onLogout,
  onOpenRecord,
}: {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  onLoginRequest: () => void;
  onLogout: () => void;
  onOpenRecord: (recordId: number) => void;
}) {
  const [records, setRecords] = useState<MyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const pageSize = 6;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    if (!token || !isLoggedIn) return;
    setLoading(true);
    api
      .listMyRecords(token)
      .then(setRecords)
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [isLoggedIn, token]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [records]);

  const visibleRecords = useMemo(() => records.slice(0, visibleCount), [records, visibleCount]);

  if (!isLoggedIn) {
    return (
      <section className="profile-view">
        <div className="page-state">
          <h2>登录后打开你的观鸟窗台</h2>
          <button className="small-action" type="button" onClick={onLoginRequest}>
            去登录
          </button>
        </div>
      </section>
    );
  }

  const speciesCount = new Set(records.map((record) => record.bird_name)).size;

  return (
    <section className="profile-view">
      <div className="window-scene">
        <button className="logout-button" type="button" onClick={onLogout} aria-label="退出登录">
          <LogOut size={18} />
        </button>

        <div className="profile-info-box">
          <div className="avatar-pixel">{user?.nickname?.slice(0, 1) ?? '啾'}</div>
          <h2>{user?.nickname ?? '观鸟新手'}</h2>
          <p>热爱自然，记录美好</p>
          <div className="profile-stats">
            <span>记录 {records.length}</span>
            <span>鸟种 {speciesCount}</span>
          </div>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>我的记录</h2>
          <p>{loading ? '正在整理...' : '回忆是最美的收藏'}</p>
        </div>
      </div>
      <div className="profile-records">
        <div className="record-grid">
          {visibleRecords.map((record) => {
            const imageUrl = resolveAssetUrl(record.cover_image_url);
            return (
              <button className="record-card" key={record.id} type="button" onClick={() => onOpenRecord(record.id)}>
                <div className="record-thumb">{imageUrl ? <img src={imageUrl} alt={record.bird_name} /> : <span>鸟</span>}</div>
                <h3>{record.bird_name}</h3>
                <p>
                  <MapPin size={14} />
                  {record.location_name ?? '校园某处'}
                </p>
                <time>{record.visibility === 'public' ? '公开' : '私密'}</time>
              </button>
            );
          })}
        </div>
        {visibleCount < records.length && (
          <button className="load-more-button" type="button" onClick={() => setVisibleCount((count) => count + pageSize)}>
            加载更多
          </button>
        )}
      </div>
    </section>
  );
}

export default ProfileView;
