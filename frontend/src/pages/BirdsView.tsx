import { ArrowLeft, CalendarDays, Clock, MapPin, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { resolveAssetUrl } from '../api/client';
import { birdGuideEntries, type BirdGuideEntry } from '../data/birdGuide';
import type { MapRecord } from '../types/models';
import { getPixelBirdAsset } from '../utils/birdAssets';
import './views.css';

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

function uniqueRecentLocations(records: MapRecord[]) {
  return Array.from(new Set(records.map((record) => record.location_name).filter(Boolean))).slice(0, 3) as string[];
}

function matchesEntry(entry: BirdGuideEntry, searchQuery: string) {
  if (!searchQuery) return true;
  const haystack = [entry.name, entry.rarity, entry.activeTime, ...entry.features, ...entry.habitats].join(' ').toLowerCase();
  return haystack.includes(searchQuery);
}

function birdRecords(records: MapRecord[], birdName: string) {
  return records
    .filter((record) => record.bird_name === birdName)
    .sort((left, right) => +new Date(right.observed_at) - +new Date(left.observed_at));
}

function BirdsView({
  records,
  searchQuery,
  onOpenRecord,
}: {
  records: MapRecord[];
  searchQuery: string;
  onOpenRecord: (recordId: number) => void;
}) {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const visibleEntries = useMemo(
    () => birdGuideEntries.filter((entry) => matchesEntry(entry, searchQuery)),
    [searchQuery],
  );
  const selectedEntry =
    birdGuideEntries.find((entry) => entry.name === selectedName) ?? (selectedName ? null : undefined);

  if (selectedEntry) {
    const recordsForBird = birdRecords(records, selectedEntry.name);
    const recentRecords = recordsForBird.slice(0, 4);
    const pixelBirdUrl = getPixelBirdAsset(selectedEntry.name);
    const recentLocations = uniqueRecentLocations(recordsForBird);

    return (
      <section className="birds-view bird-detail-view">
        <button className="bird-back-button" type="button" onClick={() => setSelectedName(null)}>
          <ArrowLeft size={18} />
          返回图鉴
        </button>

        <article className="bird-detail-hero">
          <div className="bird-detail-image">
            {pixelBirdUrl ? <img src={pixelBirdUrl} alt={selectedEntry.name} /> : <span>鸟</span>}
          </div>
          <div>
            <h2>{selectedEntry.name}</h2>
            <span className={`rarity-badge rarity-${selectedEntry.rarity}`}>{selectedEntry.rarity}</span>
          </div>
        </article>

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
              {recentRecords.map((record) => {
                const imageUrl = resolveAssetUrl(record.cover_image_url);
                return (
                  <button className="bird-record-row" key={record.id} type="button" onClick={() => onOpenRecord(record.id)}>
                    <div className="bird-record-thumb">
                      {imageUrl ? <img src={imageUrl} alt={record.bird_name} /> : pixelBirdUrl ? <img src={pixelBirdUrl} alt="" /> : <span>鸟</span>}
                    </div>
                    <div>
                      <strong>{record.location_name ?? '校园某处'}</strong>
                      <time>{formatTime(record.observed_at)}</time>
                    </div>
                  </button>
                );
              })}
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
        <h2>鸟类图鉴</h2>
        <p>{visibleEntries.length} 种校园鸟类</p>
      </div>

      <div className="bird-guide-grid">
        {visibleEntries.map((entry) => {
          const recordsForBird = birdRecords(records, entry.name);
          const weekCount = recordsForBird.filter((record) => isThisWeek(record.observed_at)).length;
          const recentLocations = uniqueRecentLocations(recordsForBird);
          const pixelBirdUrl = getPixelBirdAsset(entry.name);

          return (
            <button className="bird-guide-card" key={entry.name} type="button" onClick={() => setSelectedName(entry.name)}>
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
                  本周 {weekCount} 次
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

export default BirdsView;
