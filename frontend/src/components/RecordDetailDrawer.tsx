import { resolveAssetUrl } from '../api/client';
import type { RecordDetail } from '../types/models';
import DrawerShell from './DrawerShell';

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RecordDetailDrawer({
  record,
  loading,
  onClose,
}: {
  record: RecordDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  const imageUrl = resolveAssetUrl(record?.attachments[0]?.file_url);
  const confidence = record?.ai_candidates?.[0]?.confidence;

  return (
    <DrawerShell open={loading || Boolean(record)} title="观鸟记录" onClose={onClose}>
      {loading && <p className="drawer-note">正在寻找这条观鸟记录...</p>}
      {record && (
        <article className="detail-card">
          <div className="detail-image">{imageUrl ? <img src={imageUrl} alt={record.bird_name} /> : <span>鸟</span>}</div>
          <div className="detail-title-row">
            <h3>{record.bird_name}</h3>
            <span>{record.visibility === 'public' ? '公开' : '私密'}</span>
          </div>
          <div className="detail-meta">
            <p>记录者：{record.author.nickname}</p>
            <p>时间：{formatTime(record.observed_at)}</p>
            <p>地点：{record.location_name ?? '校园某处'}</p>
          </div>
          {typeof confidence === 'number' && (
            <div className="confidence-bar">
              <span>AI 置信度</span>
              <strong>{Math.round(confidence * 100)}%</strong>
              <i style={{ width: `${Math.round(confidence * 100)}%` }} />
            </div>
          )}
          <p className="detail-description">{record.description || '这条记录还没有备注。'}</p>
        </article>
      )}
    </DrawerShell>
  );
}

export default RecordDetailDrawer;
