import { Camera, Globe2, Lock } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api/client';
import type { BirdCandidate } from '../types/models';
import DrawerShell from './DrawerShell';

function CreateRecordDrawer({
  open,
  token,
  onClose,
  onCreated,
}: {
  open: boolean;
  token: string | null;
  onClose: () => void;
  onCreated: (recordId: number) => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BirdCandidate[]>([]);
  const [birdName, setBirdName] = useState('');
  const [locationName, setLocationName] = useState('南京大学校园');
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleImage(file: File | null) {
    setImage(file);
    setCandidates([]);
    setMessage(null);
    if (!file) {
      setPreview(null);
      return;
    }
    setPreview(URL.createObjectURL(file));
    try {
      const result = await api.identifyBird(file, token);
      setCandidates(result.candidates);
      setBirdName(result.candidates[0]?.name ?? '');
    } catch {
      setMessage('识别失败，可以手动填写鸟种继续发布。');
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    if (!birdName.trim()) {
      setMessage('请填写鸟种名称。');
      return;
    }

    const form = new FormData();
    form.append('bird_name', birdName.trim());
    form.append('ai_candidates', JSON.stringify(candidates));
    form.append('description', description);
    form.append('latitude', '32.0569');
    form.append('longitude', '118.7792');
    form.append('location_name', locationName || '南京大学校园');
    form.append('observed_at', observedAt);
    form.append('visibility', visibility);
    if (image) form.append('image', image);

    setSubmitting(true);
    setMessage(null);
    try {
      const result = await api.createRecord(form, token);
      onCreated(result.id);
      setImage(null);
      setPreview(null);
      setCandidates([]);
      setBirdName('');
      setDescription('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DrawerShell open={open} title="新建观鸟记录" onClose={onClose}>
      <form className="drawer-form" onSubmit={submit}>
        <label className="image-picker">
          {preview ? <img src={preview} alt="待发布照片" /> : <Camera size={42} />}
          <span>{preview ? '更换照片' : '添加照片，自动识别鸟种'}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleImage(event.target.files?.[0] ?? null)}
          />
        </label>

        <section className="candidate-section">
          <h3>AI 候选</h3>
          <div className="candidate-list">
            {candidates.length ? (
              candidates.map((candidate) => (
                <button
                  className={birdName === candidate.name ? 'selected' : ''}
                  key={candidate.name}
                  type="button"
                  onClick={() => setBirdName(candidate.name)}
                >
                  {candidate.name}
                  <span>{Math.round(candidate.confidence * 100)}%</span>
                </button>
              ))
            ) : (
              <p>可以先上传照片，也可以直接手动填写鸟种。</p>
            )}
          </div>
        </section>

        <label>
          鸟种
          <input value={birdName} onChange={(event) => setBirdName(event.target.value)} />
        </label>
        <label>
          位置
          <input value={locationName} onChange={(event) => setLocationName(event.target.value)} />
        </label>
        <label>
          时间
          <input type="datetime-local" value={observedAt} onChange={(event) => setObservedAt(event.target.value)} />
        </label>
        <label>
          备注
          <textarea
            value={description}
            maxLength={120}
            placeholder="记录一下你的观察吧..."
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>

        <div className="visibility-toggle">
          <button className={visibility === 'public' ? 'active' : ''} type="button" onClick={() => setVisibility('public')}>
            <Globe2 size={18} />
            公开
          </button>
          <button className={visibility === 'private' ? 'active' : ''} type="button" onClick={() => setVisibility('private')}>
            <Lock size={18} />
            私密
          </button>
        </div>

        {message && <p className={message.includes('失败') || message.includes('请') ? 'drawer-error' : 'drawer-note'}>{message}</p>}
        <button className="primary-action" type="submit" disabled={submitting}>
          {submitting ? '发布中...' : '发布记录'}
        </button>
      </form>
    </DrawerShell>
  );
}

export default CreateRecordDrawer;
