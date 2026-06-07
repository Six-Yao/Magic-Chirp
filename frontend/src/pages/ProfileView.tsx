import { Check, Edit3, LogOut, MapPin, Settings, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, resolveAssetUrl } from '../api/client';
import type { MyRecord, User } from '../types/models';
import './views.css';

function ProfileView({
  token,
  user,
  isLoggedIn,
  searchQuery,
  onLoginRequest,
  onLogout,
  onSettingsRequest,
  onProfileUpdated,
  onOpenRecord,
}: {
  token: string | null;
  user: User | null;
  isLoggedIn: boolean;
  searchQuery: string;
  onLoginRequest: () => void;
  onLogout: () => void;
  onSettingsRequest: () => void;
  onProfileUpdated: (user: User) => void;
  onOpenRecord: (recordId: number) => void;
}) {
  const [records, setRecords] = useState<MyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const pageSize = 6;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

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
  }, [records, searchQuery]);

  useEffect(() => {
    setNicknameDraft(user?.nickname ?? '');
    setBioDraft(user?.bio ?? '');
  }, [user?.bio, user?.nickname]);

  const filteredRecords = useMemo(() => {
    if (!searchQuery) return records;

    return records.filter((record) =>
      [record.bird_name, record.location_name, record.visibility === 'public' ? '公开' : '私密']
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(searchQuery)),
    );
  }, [records, searchQuery]);
  const visibleRecords = useMemo(() => filteredRecords.slice(0, visibleCount), [filteredRecords, visibleCount]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= filteredRecords.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + pageSize, filteredRecords.length));
        }
      },
      { rootMargin: '180px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredRecords.length, visibleCount]);

  if (!isLoggedIn) {
    return (
      <section className="profile-view">
        <div className="page-state">
          <h2>登录后打开你的观鸟窗口</h2>
          <button className="small-action" type="button" onClick={onLoginRequest}>
            去登录
          </button>
        </div>
      </section>
    );
  }

  const speciesCount = new Set(records.map((record) => record.bird_name)).size;

  async function handleProfileSave() {
    if (!token) return;
    setProfileSaving(true);
    setProfileError(null);
    try {
      const nextUser = await api.updateMe(token, nicknameDraft, bioDraft);
      onProfileUpdated(nextUser);
      setEditingProfile(false);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : '保存失败');
    } finally {
      setProfileSaving(false);
    }
  }

  function cancelProfileEdit() {
    setNicknameDraft(user?.nickname ?? '');
    setBioDraft(user?.bio ?? '');
    setProfileError(null);
    setEditingProfile(false);
  }

  return (
    <section className="profile-view">
      <div className="window-scene">
        <button className="profile-icon-button settings" type="button" onClick={onSettingsRequest} aria-label="打开设置">
          <Settings size={18} />
        </button>
        <button className="profile-icon-button logout" type="button" onClick={onLogout} aria-label="退出登录">
          <LogOut size={18} />
        </button>

        <div className="profile-info-box">
          <div className="avatar-pixel">{user?.nickname?.slice(0, 1) ?? '啾'}</div>
          {editingProfile ? (
            <div className="profile-edit-form">
              <input
                maxLength={24}
                value={nicknameDraft}
                aria-label="用户名"
                onChange={(event) => setNicknameDraft(event.target.value)}
              />
              <textarea
                maxLength={80}
                value={bioDraft}
                aria-label="用户签名"
                onChange={(event) => setBioDraft(event.target.value)}
              />
              {profileError && <p className="profile-error">{profileError}</p>}
              <div className="profile-edit-actions">
                <button type="button" onClick={handleProfileSave} disabled={profileSaving} aria-label="保存资料">
                  <Check size={16} />
                </button>
                <button type="button" onClick={cancelProfileEdit} aria-label="取消编辑">
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <button className="profile-name-edit" type="button" onClick={() => setEditingProfile(true)}>
                <h2>{user?.nickname ?? '观鸟新手'}</h2>
                <Edit3 size={15} />
              </button>
              <p>{user?.bio || '热爱自然，记录美好'}</p>
            </>
          )}
          <div className="profile-stats">
            <span>记录 {records.length}</span>
            <span>鸟种 {speciesCount}</span>
          </div>
        </div>
      </div>

      <div className="section-heading">
        <div>
          <h2>我的记录</h2>
          <p>{loading ? '正在整理...' : searchQuery ? `找到 ${filteredRecords.length} 条记录` : '回忆是最美的收藏'}</p>
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
        {filteredRecords.length === 0 && <div className="page-state">没有找到匹配的个人记录。</div>}
        {visibleCount < filteredRecords.length && <div className="auto-load-sentinel" ref={loadMoreRef}>继续翻页中...</div>}
      </div>
    </section>
  );
}

export default ProfileView;
