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
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  verificationNotes?: string | null;
  certificateUrl?: string | null;
  hasCertificate?: boolean;
  athlete: Pick<Athlete, 'id' | 'fullName' | 'sport' | 'district' | 'region' | 'verificationStatus' | 'photoUrl'>;
};

export type EventApplicant = {
  player: Pick<Athlete, 'id' | 'userId' | 'fullName' | 'age' | 'sport' | 'district' | 'region' | 'bio' | 'verificationStatus'> & {
    certificates: Array<{ id: string; title: string; eventDate: string | null; verificationStatus: 'verified'; certificateUrl: string }>;
  } | null;
  message: string;
  status: 'interested' | 'shortlisted' | 'selected' | 'rejected';
  appliedAt: string;
  registrationConfirmed: boolean;
  sponsorshipStatus: 'pending' | 'confirmed' | 'not_applicable';
  sponsorshipNote: string;
};

export type ScoutEvent = {
  id: string;
  title: string;
  sport: string;
  description: string;
  location: string;
  eventDate: string;
  registrationDeadline: string;
  sponsorshipDetails: string;
  status: 'open' | 'closed';
  createdBy: string;
  applicantCount: number;
  myApplication?: { status: EventApplicant['status']; sponsorshipStatus?: EventApplicant['sponsorshipStatus'] } | null;
  applicants?: EventApplicant[];
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
const tabSessionIdKey = 'rural-rise-tab-session-id';
const tabSessionIdPattern = /^[a-f\d-]{36}$/i;
let refreshInFlight: Promise<string | null> | null = null;
export const sessionExpiredEvent = 'rural-rise-session-expired';
export const sessionRestoredEvent = 'rural-rise-session-restored';

function removeLegacySharedSession(): void {
  localStorage.removeItem(sessionKey);
  localStorage.removeItem('rural-rise-user-data');
}

export function getTabSessionId(): string {
  const existing = sessionStorage.getItem(tabSessionIdKey);
  if (existing && tabSessionIdPattern.test(existing)) return existing;
  const sessionId = crypto.randomUUID();
  sessionStorage.setItem(tabSessionIdKey, sessionId);
  return sessionId;
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

function isUser(value: unknown): value is User {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string'
    && typeof candidate.username === 'string'
    && typeof candidate.email === 'string'
    && ['talent', 'host', 'admin', 'pe_teacher'].includes(candidate.role as string);
}

export function saveSession(user: User, accessToken: string): void {
  removeLegacySharedSession();
  sessionStorage.setItem(sessionKey, JSON.stringify({ user, accessToken }));
}

export function getSavedUser(): User | null {
  try {
    removeLegacySharedSession();
    const saved = sessionStorage.getItem(sessionKey);
    const userFromSession: unknown = saved ? (JSON.parse(saved) as { user?: unknown }).user : null;
    return isUser(userFromSession) ? userFromSession : null;
  } catch {
    sessionStorage.removeItem(sessionKey);
    return null;
  }
}

export function clearSession(): void {
  removeLegacySharedSession();
  sessionStorage.removeItem(sessionKey);
}

async function sendRequest(path: string, options: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('X-RuralRise-Session-Id', getTabSessionId());
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

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      let response: Response;
      try {
        const expectedUserId = getSavedUser()?.id;
        response = await fetch(`${apiBase}/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'X-RuralRise-Session-Id': getTabSessionId(),
            ...(expectedUserId ? { 'X-RuralRise-User-Id': expectedUserId } : {}),
          },
        });
      } catch {
        throw new ApiError('Unable to reach the server. Please try again in a moment.');
      }

      const body = (await response.json().catch(() => null)) as ApiEnvelope<{ user: User; accessToken: string }> | null;
      if (response.status === 401) {
        clearSession();
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
  if (response.status === 401 && !isAuthEndpoint(path)) {
    const refreshedToken = await refreshAccessToken();
    if (!refreshedToken) {
      clearSession();
      window.dispatchEvent(new Event(sessionExpiredEvent));
      throw new ApiError('Your session has expired. Please log in again.', 'SESSION_EXPIRED');
    }
    response = await sendRequest(path, options, refreshedToken);
    if (response.status === 401) {
      clearSession();
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

  return body.data;
}

export async function apiBlob(path: string): Promise<Blob> {
  let response = await sendRequest(path, {}, getToken());
  if (response.status === 401) {
    const token = await refreshAccessToken();
    if (!token) throw new ApiError('Your session has expired. Please log in again.', 'SESSION_EXPIRED');
    response = await sendRequest(path, {}, token);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiEnvelope<unknown> | null;
    throw new ApiError(body?.error?.message || 'Could not load this document.', body?.error?.code);
  }
  return response.blob();
}

export function apiAsset(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (apiBase.startsWith('http')) return new URL(path, new URL(apiBase).origin).toString();
  return path;
}
