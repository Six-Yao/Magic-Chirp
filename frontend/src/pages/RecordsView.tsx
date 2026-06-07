import { MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { resolveAssetUrl } from '../api/client';
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

function RecordsView({
  records,
  status,
  searchQuery,
  onOpenRecord,
}: {
  records: MapRecord[];
  status: 'loading' | 'ready' | 'error';
  searchQuery: string;
  onOpenRecord: (recordId: number) => void;
}) {
  const pageSize = 8;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [records]);

  const visibleRecords = useMemo(() => records.slice(0, visibleCount), [records, visibleCount]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= records.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((count) => Math.min(count + pageSize, records.length));
        }
      },
      { rootMargin: '180px 0px' },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [records.length, visibleCount]);

  if (status === 'loading') {
    return <div className="page-state">正在翻看全校观鸟记录...</div>;
  }

  if (status === 'error') {
    return <div className="page-state">公开记录暂时飞走了，请稍后再试。</div>;
  }

  if (records.length === 0) {
    return <div className="page-state">{searchQuery ? '没有找到匹配的观鸟记录。' : '还没有公开观鸟记录。'}</div>;
  }

  return (
    <section className="records-view">
      <div className="section-heading">
        <h2>全校公开记录</h2>
        <p>{records.length} 条校园观鸟手账</p>
      </div>
      <div className="record-grid">
        {visibleRecords.map((record) => {
          const imageUrl = resolveAssetUrl(record.cover_image_url);
          const pixelBirdUrl = getPixelBirdAsset(record.bird_name);
          return (
            <button className="record-card" key={record.id} type="button" onClick={() => onOpenRecord(record.id)}>
              <div className={`record-thumb${imageUrl ? '' : ' pixel-bird-thumb'}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={record.bird_name} />
                ) : pixelBirdUrl ? (
                  <img src={pixelBirdUrl} alt={record.bird_name} />
                ) : (
                  <span>鸟</span>
                )}
              </div>
              <h3>{record.bird_name}</h3>
              <p>
                <MapPin size={14} />
                {record.location_name ?? '校园某处'}
              </p>
              <time>{formatTime(record.observed_at)}</time>
            </button>
          );
        })}
      </div>
      {visibleCount < records.length && <div className="auto-load-sentinel" ref={loadMoreRef}>继续翻页中...</div>}
    </section>
  );
}

export default RecordsView;
