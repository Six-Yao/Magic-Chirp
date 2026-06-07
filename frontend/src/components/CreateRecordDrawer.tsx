import { Camera, Crosshair, Globe2, LocateFixed, Lock, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { BirdCandidate, BirdPointLocation, LocationCache, PublicRecordOptions } from '../types/models';
import DrawerShell from './DrawerShell';

const DEFAULT_LOCATION: BirdPointLocation = {
  latitude: 32.0569,
  longitude: 118.7792,
  locationName: '南京大学校园',
  source: 'default',
};

function matchLocationName(
  location: Pick<BirdPointLocation, 'latitude' | 'longitude'>,
  locations: PublicRecordOptions['locations'],
) {
  return Object.entries(locations).find(([, bounds]) => {
    const [longitudeLeft, longitudeRight, latitudeLeft, latitudeRight] = bounds;
    const minLongitude = Math.min(longitudeLeft, longitudeRight);
    const maxLongitude = Math.max(longitudeLeft, longitudeRight);
    const minLatitude = Math.min(latitudeLeft, latitudeRight);
    const maxLatitude = Math.max(latitudeLeft, latitudeRight);

    return (
      location.longitude >= minLongitude &&
      location.longitude <= maxLongitude &&
      location.latitude >= minLatitude &&
      location.latitude <= maxLatitude
    );
  })?.[0];
}

function CreateRecordDrawer({
  open,
  token,
  selectedLocation,
  locations,
  currentLocation,
  currentLocationStatus,
  onClose,
  onCreated,
  onPickOnMap,
}: {
  open: boolean;
  token: string | null;
  selectedLocation: BirdPointLocation | null;
  locations: PublicRecordOptions['locations'];
  currentLocation: BirdPointLocation | null;
  currentLocationStatus: LocationCache['status'];
  onClose: () => void;
  onCreated: (recordId: number) => void;
  onPickOnMap: () => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<BirdCandidate[]>([]);
  const [birdName, setBirdName] = useState('');
  const [location, setLocation] = useState<BirdPointLocation>(selectedLocation ?? DEFAULT_LOCATION);
  const [locationName, setLocationName] = useState(selectedLocation?.locationName ?? DEFAULT_LOCATION.locationName);
  const [observedAt, setObservedAt] = useState(new Date().toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!selectedLocation) return;
    const matchedLocation = matchLocationName(selectedLocation, locations);
    setLocation(selectedLocation);
    setLocationName(matchedLocation ?? selectedLocation.locationName ?? '地图点选位置');
  }, [locations, selectedLocation]);

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
    if (!image) {
      setMessage('请先添加照片。');
      return;
    }

    const form = new FormData();
    form.append('bird_name', birdName.trim());
    form.append('ai_candidates', JSON.stringify(candidates));
    form.append('description', description);
    form.append('latitude', String(location.latitude));
    form.append('longitude', String(location.longitude));
    const submittedLocationName = locationName || location.locationName || '南京大学校园';
    form.append('location_name', submittedLocationName);
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

  function useCurrentLocation() {
    if (currentLocationStatus === 'unsupported') {
      setMessage('当前浏览器不支持定位，可以改用地图点选。');
      return;
    }
    if (!currentLocation) {
      setMessage(currentLocationStatus === 'error' ? '定位缓存更新失败，可以改用地图点选。' : '当前位置还在获取中，请稍后再试。');
      return;
    }

    const matchedLocation = matchLocationName(currentLocation, locations);
    const nextLocation = {
      ...currentLocation,
      locationName: matchedLocation ?? currentLocation.locationName ?? '当前位置',
    };
    setLocation(nextLocation);
    setLocationName(nextLocation.locationName);
    setMessage(null);
  }

  function pickOnMap() {
    onPickOnMap();
    setMessage('在地图上点击一下，就会把鸟点位置带回这里。');
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
        <div className="location-tools">
          <button type="button" onClick={useCurrentLocation}>
            <LocateFixed size={18} />
            当前定位
          </button>
          <button type="button" onClick={pickOnMap}>
            <Crosshair size={18} />
            地图点选
          </button>
        </div>
        <p className="location-readout">
          <MapPin size={16} />
          {location.source === 'gps' ? '定位' : location.source === 'map' ? '点选' : '默认'}：
          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
        </p>
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
