export type User = {
  id: string;
  username: string;
  email: string;
  role: 'talent' | 'host' | 'admin' | 'pe_teacher';
  hostVerificationStatus?: 'pending' | 'verified' | 'rejected';
  isVerified?: boolean;
  verificationMethod?: 'domain_auto' | 'read_only_pending' | 'manual_approved' | 'pending_review';
  institutionName?: string;
  district?: string;
};

export type Athlete = {
  id: string;
  userId: string;
  fullName: string;
  age: number;
  sport: string;
  district: string;
  region: string;
  background: string;
  tournaments: string[];
  bio: string;
  verificationStatus: 'pending' | 'verified' | 'rejected';
  planTier: 'standard' | 'pro';
  photoUrl: string;
  createdAt: string;
};

export type Connection = {
  id: string;
  athlete: Pick<Athlete, 'id' | 'fullName' | 'sport' | 'district' | 'verificationStatus'> | null;
  message: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

export type AchievementPost = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  createdAt: string;
  photoUrl: string | null;
  videoUrl: string | null;
  mediaType: 'image' | 'video';
  endorsementStatus?: 'unverified' | 'endorsed' | 'correction_requested';
  endorsementNote?: string | null;
  athlete: Pick<Athlete, 'id' | 'fullName' | 'sport' | 'district' | 'region' | 'verificationStatus' | 'photoUrl'>;
};

export type AchievementPostPage = {
  items: AchievementPost[];
  page: number;
  pages: number;
  total: number;
};

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: { code?: string; message?: string; fields?: Record<string, string[]> };
};

const apiBase = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const sessionKey = 'rural-rise-session';
const localStorageUserKey = 'rural-rise-user-data';
let refreshInFlight: Promise<string | null> | null = null;
export const sessionExpiredEvent = 'rural-rise-session-expired';
export const sessionRestoredEvent = 'rural-rise-session-restored';

function removeLegacySharedSession(): void {
  localStorage.removeItem(sessionKey);
}

export class ApiError extends Error {
  code?: string;
  fields?: Record<string, string[]>;

  constructor(message: string, code?: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fields = fields;
  }
}

export function getToken(): string | null {
  try {
    removeLegacySharedSession();
    const saved = sessionStorage.getItem(sessionKey);
    return saved ? (JSON.parse(saved) as { accessToken?: string }).accessToken ?? null : null;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

export function getLocalUser(): User | null {
  try {
    const saved = localStorage.getItem(localStorageUserKey);
    if (!saved) return null;
    return JSON.parse(saved) as User;
  } catch {
    localStorage.removeItem(localStorageUserKey);
    return null;
  }
}

export function saveLocalUser(user: User): void {
  try {
    localStorage.setItem(localStorageUserKey, JSON.stringify(user));
  } catch {
    // ignore if localStorage is full or unavailable
  }
}

export function clearLocalUser(): void {
  localStorage.removeItem(localStorageUserKey);
}

export function saveSession(user: User, accessToken: string): void {
  removeLegacySharedSession();
  sessionStorage.setItem(sessionKey, JSON.stringify({ user, accessToken }));
  saveLocalUser(user);
}

export function getSavedUser(): User | null {
  try {
    removeLegacySharedSession();
    const saved = sessionStorage.getItem(sessionKey);
    const userFromSession = saved ? (JSON.parse(saved) as { user?: User }).user ?? null : null;
    if (!userFromSession) {
      const localUser = getLocalUser();
      if (localUser) {
        removeLegacySharedSession();
        sessionStorage.setItem(sessionKey, JSON.stringify({ user: localUser, accessToken: getToken() }));
      }
      return localUser;
    }
    return userFromSession;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

export function clearSession(): void {
  removeLegacySharedSession();
  sessionStorage.removeItem(sessionKey);
  clearLocalUser();
}

async function sendRequest(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    return await fetch(`${apiBase}${path}`, { ...options, headers, credentials: 'include' });
  } catch {
    throw new ApiError('Unable to reach the server. Please try again in a moment.');
  }
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      let response: Response;
      try {
        response = await fetch(`${apiBase}/refresh`, { method: 'POST', credentials: 'include' });
      } catch {
        throw new ApiError('Unable to reach the server. Please try again in a moment.');
      }

      const body = (await response.json().catch(() => null)) as ApiEnvelope<{ user: User; accessToken: string }> | null;
      if (response.status === 401) {
        return null;
      }
      if (!response.ok || !body?.success) {
        throw new ApiError(
          body?.error?.message || `The request could not be completed (${response.status}).`,
          body?.error?.code,
          body?.error?.fields,
        );
      }

      saveSession(body.data.user, body.data.accessToken);
      window.dispatchEvent(new Event(sessionRestoredEvent));
      return body.data.accessToken;
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function isAuthEndpoint(path: string): boolean {
  return ['/login', '/register', '/refresh', '/logout'].some((endpoint) => path === endpoint);
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  let response = await sendRequest(path, options, token);
  if (response.status === 401 && token && !isAuthEndpoint(path)) {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      window.dispatchEvent(new Event(sessionExpiredEvent));
      throw new ApiError('Your session has expired. Please log in again.', 'SESSION_EXPIRED');
    }
    response = await sendRequest(path, options, refreshedToken);
    if (response.status === 401) {
      window.dispatchEvent(new Event(sessionExpiredEvent));
      throw new ApiError('Your session has expired. Please log in again.', 'SESSION_EXPIRED');
    }
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !body?.success) {
    throw new ApiError(
      body?.error?.message || `The request could not be completed (${response.status}).`,
      body?.error?.code,
      body?.error?.fields,
    );
  }

  if (body.data) {
    const responseUser = Array.isArray(body.data) ? body.data[0] : body.data;
    if (responseUser && typeof responseUser === 'object' && 'id' in responseUser) {
      const user = responseUser as User;
      if (token) {
        saveLocalUser(user);
      }
    }
  }
  return body.data;
}

export function apiAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (apiBase.startsWith('http')) return new URL(path, new URL(apiBase).origin).toString();
  return path;
}
