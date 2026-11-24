import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import { ApiError, api, clearSession, getSavedUser, getToken, refreshAccessToken, saveLocalUser, saveSession, sessionExpiredEvent, sessionRestoredEvent, type User } from './api';

type Credentials = { email: string; password: string };
type Registration = Credentials & { username: string; role: 'talent' | 'host' | 'pe_teacher'; institutionName?: string; district?: string };
type AuthContextValue = {
  user: User | null;
  isInitializing: boolean;
  signIn: (credentials: Credentials) => Promise<User>;
  signUp: (details: Registration) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getSavedUser());
  const [initialized, setInitialized] = useState(false);

  async function authenticate(endpoint: string, details: Credentials | Registration): Promise<User> {
    const result = await api<{ user: User; accessToken: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify(details),
    });
    saveSession(result.user, result.accessToken);
    setUser(result.user);
    return result.user;
  }

  async function fetchCurrentUser() {
    try {
      const response = await api<User | { user: User }>('/me');
      const userData = response && typeof response === 'object' && 'user' in response && response.user
        ? response.user
        : (response as User);
      setUser(userData);
      saveLocalUser(userData);
      const token = getToken();
      if (token) saveSession(userData, token);
      return userData;
    } catch (requestError) {
      const sessionInvalid = requestError instanceof ApiError
        && ['AUTH_REQUIRED', 'INVALID_TOKEN', 'SESSION_EXPIRED'].includes(requestError.code ?? '');
      if (sessionInvalid) {
        setUser(null);
        clearSession();
      }
      throw requestError;
    }
  }

  useEffect(() => {
    let active = true;

    async function initSession() {
      const token = getToken();
      const savedUser = getSavedUser();
      if (savedUser || token) {
        try {
          await fetchCurrentUser();
        } catch {
          // fetchCurrentUser handles session clearing on auth error
        }
      } else {
        try {
          const refreshedToken = await refreshAccessToken();
          if (refreshedToken && active) {
            const restoredUser = getSavedUser();
            if (restoredUser) setUser(restoredUser);
          }
        } catch {
          // Guest user or no refresh cookie
        }
      }
      if (active) setInitialized(true);
    }

    void initSession();

    const handleExpired = () => {
      setUser(null);
      clearSession();
    };
    const handleRestored = () => {
      const saved = getSavedUser();
      if (saved) setUser(saved);
    };
    window.addEventListener(sessionExpiredEvent, handleExpired);
    window.addEventListener(sessionRestoredEvent, handleRestored);

    return () => {
      active = false;
      window.removeEventListener(sessionExpiredEvent, handleExpired);
      window.removeEventListener(sessionRestoredEvent, handleRestored);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isInitializing: !initialized,
    signIn: (credentials) => authenticate('/login', credentials),
    signUp: async (details) => { await authenticate('/register', details); },
    signOut: async () => {
      try {
        await api('/logout', { method: 'POST' });
      } finally {
        clearSession();
        setUser(null);
      }
    },
  }), [user, initialized]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
}
