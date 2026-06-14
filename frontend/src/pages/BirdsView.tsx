import { ArrowLeft, CalendarDays, Clock, MapPin, Sparkles } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { api, resolveAssetUrl } from '../api/client';
import { birdGuideEntries, type BirdGuideEntry } from '../data/birdGuide';
import type { MapRecord, MyRecord } from '../types/models';
import { getPixelBirdAsset } from '../utils/birdAssets';
import './views.css';

const rarityRank: Record<BirdGuideEntry['rarity'], number> = {
  少见: 0,
  偶见: 1,
  常见: 2,
};

type BirdRecordLike = Pick<MapRecord, 'id' | 'bird_name' | 'location_name' | 'observed_at' | 'cover_image_url'>;

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isThisWeek(value: string) {
  const observedAt = new Date(value).getTime();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return observedAt >= weekAgo;
}

function uniqueRecentLocations(records: BirdRecordLike[]) {
  return Array.from(new Set(records.map((record) => record.location_name).filter(Boolean))).slice(0, 3) as string[];
}

function matchesEntry(entry: BirdGuideEntry, searchQuery: string) {
  if (!searchQuery) return true;
  const haystack = [entry.name, entry.rarity, entry.activeTime, ...entry.features, ...entry.habitats].join(' ').toLowerCase();
  return haystack.includes(searchQuery);
}

function birdRecords<T extends BirdRecordLike>(records: T[], birdName: string) {
  return records
    .filter((record) => record.bird_name === birdName)
    .sort((left, right) => +new Date(right.observed_at) - +new Date(left.observed_at));
}

function compareGuideEntries(left: BirdGuideEntry, right: BirdGuideEntry, myRecords: MyRecord[]) {
  const leftRecords = birdRecords(myRecords, left.name);
  const rightRecords = birdRecords(myRecords, right.name);
  const leftCollected = leftRecords.length > 0;
  const rightCollected = rightRecords.length > 0;

  if (leftCollected !== rightCollected) return leftCollected ? -1 : 1;
  if (rarityRank[left.rarity] !== rarityRank[right.rarity]) return rarityRank[left.rarity] - rarityRank[right.rarity];
  if (leftRecords.length !== rightRecords.length) return rightRecords.length - leftRecords.length;
  return left.name.localeCompare(right.name, 'zh-CN');
}

function BirdsView({
  records,
  searchQuery,
  token,
  onOpenRecord,
}: {
  records: MapRecord[];
  searchQuery: string;
  token: string | null;
  onOpenRecord: (recordId: number) => void;
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [myRecords, setMyRecords] = useState<MyRecord[]>([]);

  useEffect(() => {
    if (!token) {
      setMyRecords([]);
      return;
    }

    let cancelled = false;
    api
      .listMyRecords(token)
      .then((items) => {
        if (!cancelled) setMyRecords(items);
      })
      .catch(() => {
        if (!cancelled) setMyRecords([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const visibleEntries = useMemo(
    () =>
      birdGuideEntries
        .filter((entry) => matchesEntry(entry, searchQuery))
        .sort((left, right) => compareGuideEntries(left, right, myRecords)),
    [myRecords, searchQuery],
  );
  const selectedEntry =
    birdGuideEntries.find((entry) => entry.name === selectedName) ?? (selectedName ? null : undefined);
  const collectedCount = birdGuideEntries.filter((entry) => birdRecords(myRecords, entry.name).length > 0).length;

  if (selectedEntry) {
    const recordsForBird = birdRecords(records, selectedEntry.name);
    const myRecordsForBird = birdRecords(myRecords, selectedEntry.name);
    const recentRecords = recordsForBird.slice(0, 4);
    const recentMyRecords = myRecordsForBird.slice(0, 4);
    const pixelBirdUrl = getPixelBirdAsset(selectedEntry.name);
    const recentLocations = uniqueRecentLocations(recordsForBird);
    const collected = myRecordsForBird.length > 0;

    return (
      <section className="birds-view bird-detail-view">
        <button className="bird-back-button" type="button" onClick={() => setSelectedName(null)}>
          <ArrowLeft size={18} />
          返回图鉴
        </button>

        <article className={`bird-detail-hero${collected ? '' : ' uncollected'}`}>
          <div className="bird-detail-image">
            {pixelBirdUrl ? <img src={pixelBirdUrl} alt={selectedEntry.name} /> : <span>鸟</span>}
          </div>
          <div>
            <h2>{selectedEntry.name}</h2>
            <span className={`rarity-badge rarity-${selectedEntry.rarity}`}>{selectedEntry.rarity}</span>
            <p className="collection-status">{collected ? `我记录过 ${myRecordsForBird.length} 次` : '我还没有记录过它'}</p>
          </div>
        </article>

        <section className="bird-info-panel">
          <h3>我的记录</h3>
          {recentMyRecords.length > 0 ? (
            <div className="bird-record-list">
              {recentMyRecords.map((record) => (
                <BirdRecordRow key={record.id} record={record} fallbackImage={pixelBirdUrl} onOpenRecord={onOpenRecord} />
              ))}
            </div>
          ) : (
            <p className="bird-detail-note">还没有收集到这一种，去校园里遇见它吧。</p>
          )}
        </section>

        <section className="bird-info-panel">
          <h3>识别特征</h3>
          <ul>
            {selectedEntry.features.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <section className="bird-info-panel">
          <h3>常见地点</h3>
          <div className="bird-tag-row">
            {selectedEntry.habitats.map((habitat) => (
              <span key={habitat}>{habitat}</span>
            ))}
          </div>
        </section>

        <section className="bird-info-panel">
          <h3>常见时间</h3>
          <p>
            <Clock size={16} />
            {selectedEntry.activeTime}
          </p>
        </section>

        <section className="bird-info-panel">
          <h3>校园记录</h3>
          <div className="book-stats compact">
            <span>
              <Sparkles size={15} />
              本周 {recordsForBird.filter((record) => isThisWeek(record.observed_at)).length} 次
            </span>
            <span>累计 {recordsForBird.length} 次</span>
          </div>
          <p className="bird-detail-note">
            {recentLocations.length ? `最近出现在：${recentLocations.join('、')}` : '还没有校园公开记录，等待第一次发现。'}
          </p>
          {recentRecords.length > 0 && (
            <div className="bird-record-list">
              {recentRecords.map((record) => (
                <BirdRecordRow key={record.id} record={record} fallbackImage={pixelBirdUrl} onOpenRecord={onOpenRecord} />
              ))}
            </div>
          )}
        </section>
      </section>
    );
  }

  if (visibleEntries.length === 0) {
    return <div className="page-state">没有找到匹配的鸟种。</div>;
  }

  return (
    <section className="birds-view">
      <div className="section-heading">
        <h2>我的鸟类图鉴</h2>
        <p>
          已记录 {collectedCount}/{birdGuideEntries.length} 种
        </p>
      </div>

      <div className="bird-guide-grid">
        {visibleEntries.map((entry, index) => {
          const recordsForBird = birdRecords(records, entry.name);
          const myRecordsForBird = birdRecords(myRecords, entry.name);
          const weekCount = recordsForBird.filter((record) => isThisWeek(record.observed_at)).length;
          const recentLocations = uniqueRecentLocations(myRecordsForBird.length ? myRecordsForBird : recordsForBird);
          const pixelBirdUrl = getPixelBirdAsset(entry.name);
          const collected = myRecordsForBird.length > 0;

          return (
            <button
              className={`bird-guide-card${collected ? ' collected' : ' uncollected'}`}
              key={entry.name}
              type="button"
              style={{ '--bird-index': index } as CSSProperties}
              onClick={() => setSelectedName(entry.name)}
            >
              <div className="bird-guide-image">
                {pixelBirdUrl ? <img src={pixelBirdUrl} alt={entry.name} /> : <span>鸟</span>}
              </div>
              <div className="bird-guide-content">
                <div className="bird-guide-title">
                  <h3>{entry.name}</h3>
                  <span className={`rarity-badge rarity-${entry.rarity}`}>{entry.rarity}</span>
                </div>
                <p>
                  <CalendarDays size={14} />
                  {collected ? `我记录过 ${myRecordsForBird.length} 次` : `未记录，本周校园 ${weekCount} 次`}
                </p>
                <p>
                  <MapPin size={14} />
                  {recentLocations.length ? recentLocations.join('、') : entry.habitats.slice(0, 2).join('、')}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function BirdRecordRow({
  record,
  fallbackImage,
  onOpenRecord,
}: {
  record: BirdRecordLike;
  fallbackImage: string | null;
  onOpenRecord: (recordId: number) => void;
}) {
  const imageUrl = resolveAssetUrl(record.cover_image_url);

  return (
    <button className="bird-record-row" type="button" onClick={() => onOpenRecord(record.id)}>
      <div className="bird-record-thumb">
        {imageUrl ? <img src={imageUrl} alt={record.bird_name} /> : fallbackImage ? <img src={fallbackImage} alt="" /> : <span>鸟</span>}
      </div>
      <div>
        <strong>{record.location_name ?? '校园某处'}</strong>
        <time>{formatTime(record.observed_at)}</time>
      </div>
    </button>
  );
}

export default BirdsView;
