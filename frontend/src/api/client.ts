import type {
  CreateRecordResponse,
  IdentifyResponse,
  LoginResponse,
  MapRecord,
  MyRecord,
  PublicRecord,
  PublicRecordOptions,
  RecordDetail,
  RecordQuery,
  User,
} from '../types/models';

const API_BASE_URL = '';

type RequestOptions = {
  token?: string | null;
  body?: BodyInit | Record<string, unknown>;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
  };

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  if (options.body instanceof FormData) {
    init.body = options.body;
  } else if (options.body) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const message = await response
      .json()
      .then((data) => data.detail ?? response.statusText)
      .catch(() => response.statusText);
    throw new Error(String(message));
  }

  return response.json() as Promise<T>;
}

function buildRecordQuery(query: RecordQuery = {}) {
  const params = new URLSearchParams();
  if (query.birdName) params.set('bird_name', query.birdName);
  if (query.publisher) params.set('publisher', query.publisher);
  if (query.startTime) params.set('start_time', query.startTime);
  if (query.endTime) params.set('end_time', query.endTime);
  if (query.startDate) params.set('start_date', query.startDate);
  if (query.endDate) params.set('end_date', query.endDate);
  const value = params.toString();
  return value ? `?${value}` : '';
}

export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

export const api = {
  getMe: (token: string) => request<User>('/api/auth/me', { token }),
  updateMe: (token: string, nickname: string, bio: string) =>
    request<User>('/api/auth/me', {
      method: 'PATCH',
      token,
      body: { nickname, bio },
    }),
  login: (email: string, password: string) =>
    request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    }),
  register: (email: string, password: string, nickname: string) =>
    request<User>('/api/auth/register', {
      method: 'POST',
      body: { email, password, nickname },
    }),
  listMapRecords: (query?: RecordQuery) =>
    request<MapRecord[]>(`/api/map/records${buildRecordQuery(query)}`),
  listPublicRecords: (query?: RecordQuery) =>
    request<PublicRecord[]>(`/api/records/public${buildRecordQuery(query)}`),
  getRecordOptions: () => request<PublicRecordOptions>('/api/records/options'),
  getRecordDetail: (id: number, token?: string | null) =>
    request<RecordDetail>(`/api/records/${id}`, { token }),
  deleteRecord: (id: number, token: string) =>
    request<{ message: string; id: number; deleted_files: string[] }>(`/api/records/${id}`, {
      method: 'DELETE',
      token,
    }),
  listMyRecords: (token: string) => request<MyRecord[]>('/api/records/mine', { token }),
  identifyBird: (image: File, token?: string | null) => {
    const form = new FormData();
    form.append('image', image);
    return request<IdentifyResponse>('/api/identify', {
      method: 'POST',
      token,
      body: form,
    });
  },
  createRecord: (form: FormData, token: string) =>
    request<CreateRecordResponse>('/api/records', {
      method: 'POST',
      token,
      body: form,
    }),
};
