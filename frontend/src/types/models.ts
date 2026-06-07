export type ActiveTab = 'map' | 'records' | 'birds' | 'profile';

export type User = {
  id: number;
  email: string;
  nickname: string;
  bio: string;
  role: string;
};

export type AuthState = {
  token: string | null;
  user: User | null;
  status: 'checking' | 'guest' | 'authenticated';
};

export type MapRecord = {
  id: number;
  bird_name: string;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  observed_at: string;
  cover_image_url?: string | null;
  author_nickname: string;
};

export type PublicRecord = MapRecord & {
  description?: string | null;
};

export type PublicRecordOptions = {
  bird_names: string[];
  location_names: string[];
};

export type RecordQuery = {
  birdName?: string;
  publisher?: string;
  startTime?: string;
  endTime?: string;
  startDate?: string;
  endDate?: string;
};

export type BirdCandidate = {
  name: string;
  confidence: number;
};

export type RecordAttachment = {
  file_url: string;
  file_type: string;
};

export type RecordDetail = {
  id: number;
  bird_name: string;
  ai_candidates?: BirdCandidate[] | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  location_name?: string | null;
  observed_at: string;
  visibility: 'public' | 'private';
  author: {
    id: number;
    nickname: string;
  };
  attachments: RecordAttachment[];
  created_at: string;
};

export type MyRecord = {
  id: number;
  bird_name: string;
  location_name?: string | null;
  observed_at: string;
  visibility: 'public' | 'private';
  cover_image_url?: string | null;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type IdentifyResponse = {
  candidates: BirdCandidate[];
  source: string;
};

export type CreateRecordResponse = {
  id: number;
  bird_name: string;
  detail_url: string;
  message: string;
};

export type RecordFilter = {
  dateRange: 'all' | 'week' | 'month';
};
