import type {
  CreateRecordResponse,
  IdentifyResponse,
  LoginResponse,
  MapRecord,
  MyRecord,
  RecordDetail,
  User,
} from '../types/models';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

type RequestOptions = {
  token?: string | null;
  body?: BodyInit | Record<string, unknown>;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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

export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
}

export const api = {
  getMe: (token: string) => request<User>('/api/auth/me', { token }),
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
  listMapRecords: () => request<MapRecord[]>('/api/map/records'),
  getRecordDetail: (id: number, token?: string | null) =>
    request<RecordDetail>(`/api/records/${id}`, { token }),
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
